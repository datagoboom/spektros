const asar = require('@electron/asar');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

class ElectronIntegrityBypass {
    constructor() {
        this.currentHash = null;
        this.newHash = null;
        this.executablePath = null;
        this.asarPath = null;
    }

    /**
     * Extract hash from executable binary using strings command
     * @param {string} executablePath - Path to the executable file
     * @returns {string|null} - The extracted hash or null if not found
     */
    extractHashFromBinary(executablePath) {
        try {
            // Read the binary file
            const binaryContent = fs.readFileSync(executablePath, 'utf8');
            
            // Look for the integrity hash pattern
            const hashPattern = /"alg":"SHA256","value":"([a-f0-9]{64})"/g;
            const match = hashPattern.exec(binaryContent);
            
            if (match) {
                this.currentHash = match[1];
                return this.currentHash;
            }
            
            // Alternative: try using strings command if available
            try {
                const stringsOutput = execSync(`strings "${executablePath}" | grep '"alg":"SHA256"'`, { encoding: 'utf8' });
                const stringsMatch = /"value":"([a-f0-9]{64})"/.exec(stringsOutput);
                if (stringsMatch) {
                    this.currentHash = stringsMatch[1];
                    return this.currentHash;
                }
            } catch (e) {
                // strings command not available, continue with binary read method
            }
            
            return null;
        } catch (error) {
            throw new Error(`Error extracting hash from binary: ${error.message}`);
        }
    }

    /**
     * Calculate SHA256 hash of ASAR header string
     * @param {string} asarPath - Path to the ASAR file
     * @returns {string} - The calculated SHA256 hash
     */
    calculateAsarHash(asarPath) {
        try {
            const rawHeader = asar.getRawHeader(asarPath);
            const hash = crypto.createHash('sha256')
                .update(rawHeader.headerString)
                .digest('hex');
            
            return hash;
        } catch (error) {
            throw new Error(`Error calculating ASAR hash: ${error.message}`);
        }
    }

    /**
     * Extract ASAR archive to a directory
     * @param {string} asarPath - Path to the ASAR file
     * @param {string} outputDir - Directory to extract to
     * @returns {boolean} - Success status
     */
    extractAsar(asarPath, outputDir) {
        try {
            // Remove output directory if it exists
            if (fs.existsSync(outputDir)) {
                fs.rmSync(outputDir, { recursive: true, force: true });
            }
            
            asar.extractAll(asarPath, outputDir);
            return true;
        } catch (error) {
            throw new Error(`Error extracting ASAR: ${error.message}`);
        }
    }

    /**
     * Pack directory back into ASAR archive
     * @param {string} sourceDir - Directory to pack
     * @param {string} asarPath - Output ASAR file path
     * @param {boolean} createBackup - Whether to create backup of original
     * @returns {boolean} - Success status
     */
    packAsar(sourceDir, asarPath, createBackup = true) {
        try {
            // Backup original ASAR
            if (createBackup) {
                const backupPath = asarPath + '.backup';
                if (fs.existsSync(asarPath) && !fs.existsSync(backupPath)) {
                    fs.copyFileSync(asarPath, backupPath);
                }
            }
            
            asar.createPackage(sourceDir, asarPath);
            return true;
        } catch (error) {
            throw new Error(`Error packing ASAR: ${error.message}`);
        }
    }

    /**
     * Replace hash in executable binary
     * @param {string} executablePath - Path to executable
     * @param {string} oldHash - Hash to replace
     * @param {string} newHash - New hash value
     * @param {boolean} createBackup - Whether to create backup of original
     * @returns {boolean} - Success status
     */
    replaceHashInBinary(executablePath, oldHash, newHash, createBackup = true) {
        try {
            // Backup original executable
            if (createBackup) {
                const backupPath = executablePath + '.backup';
                if (!fs.existsSync(backupPath)) {
                    fs.copyFileSync(executablePath, backupPath);
                }
            }
            
            // Read binary content
            let binaryContent = fs.readFileSync(executablePath);
            
            // Convert hashes to buffers for binary replacement
            const oldHashBuffer = Buffer.from(oldHash, 'utf8');
            const newHashBuffer = Buffer.from(newHash, 'utf8');
            
            // Find and replace
            const oldIndex = binaryContent.indexOf(oldHashBuffer);
            if (oldIndex === -1) {
                return false;
            }
            
            // Replace the hash
            newHashBuffer.copy(binaryContent, oldIndex);
            
            // Write back to file
            fs.writeFileSync(executablePath, binaryContent);
            return true;
        } catch (error) {
            throw new Error(`Error replacing hash in binary: ${error.message}`);
        }
    }

    /**
     * Run executable and capture integrity error to get new hash
     * @param {string} executablePath - Path to executable
     * @param {number} timeout - Timeout in milliseconds (default: 5000)
     * @returns {Promise<{storedHash: string, runtimeHash: string}|null>}
     */
    getHashFromError(executablePath, timeout = 5000) {
        return new Promise((resolve) => {
            const child = spawn(executablePath, [], {
                stdio: ['pipe', 'pipe', 'pipe'],
                windowsHide: true
            });
            
            let errorOutput = '';
            
            child.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });
            
            child.on('close', (code) => {
                // Look for integrity check failed message
                const errorMatch = /Integrity check failed for asar archive \(([a-f0-9]{64}) vs ([a-f0-9]{64})\)/.exec(errorOutput);
                
                if (errorMatch) {
                    const [, storedHash, runtimeHash] = errorMatch;
                    resolve({ storedHash, runtimeHash });
                } else {
                    resolve(null);
                }
            });
            
            child.on('error', (error) => {
                resolve(null);
            });
            
            // Kill process after timeout if it doesn't exit
            setTimeout(() => {
                if (!child.killed) {
                    child.kill();
                }
            }, timeout);
        });
    }

    /**
     * Check if integrity validation is enabled using electron-fuses
     * @param {string} executablePath - Path to executable
     * @returns {Promise<boolean|null>} - True if enabled, false if disabled, null if unknown
     */
    async checkIntegrityStatus(executablePath) {
        try {
            const output = execSync(`npx @electron/fuses read --app "${executablePath}"`, { 
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            if (output.includes('EnableEmbeddedAsarIntegrityValidation is Enabled')) {
                return true;
            } else if (output.includes('EnableEmbeddedAsarIntegrityValidation is Disabled')) {
                return false;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get ASAR file info including header details
     * @param {string} asarPath - Path to ASAR file
     * @returns {Object} - ASAR file information
     */
    getAsarInfo(asarPath) {
        try {
            const rawHeader = asar.getRawHeader(asarPath);
            const hash = crypto.createHash('sha256')
                .update(rawHeader.headerString)
                .digest('hex');
            
            return {
                headerSize: rawHeader.headerSize,
                headerString: rawHeader.headerString,
                header: rawHeader.header,
                hash: hash,
                fileCount: this._countFiles(rawHeader.header.files)
            };
        } catch (error) {
            throw new Error(`Error getting ASAR info: ${error.message}`);
        }
    }

    /**
     * Count files in ASAR header
     * @private
     */
    _countFiles(files) {
        let count = 0;
        for (const [name, info] of Object.entries(files)) {
            if (info.files) {
                count += this._countFiles(info.files);
            } else {
                count++;
            }
        }
        return count;
    }

    /**
     * Validate if current ASAR matches stored hash
     * @param {string} executablePath - Path to executable
     * @param {string} asarPath - Path to ASAR file
     * @returns {Object} - Validation result
     */
    validateIntegrity(executablePath, asarPath) {
        try {
            const storedHash = this.extractHashFromBinary(executablePath);
            const currentHash = this.calculateAsarHash(asarPath);
            
            return {
                storedHash,
                currentHash,
                isValid: storedHash === currentHash,
                needsBypass: storedHash !== currentHash
            };
        } catch (error) {
            throw new Error(`Error validating integrity: ${error.message}`);
        }
    }

    /**
     * Complete bypass workflow
     * @param {string} executablePath - Path to executable
     * @param {string} asarPath - Path to ASAR file
     * @param {Function} modificationsCallback - Optional callback for modifications
     * @param {Object} options - Options object
     * @returns {Promise<Object>} - Bypass result
     */
    async bypassIntegrity(executablePath, asarPath, modificationsCallback = null, options = {}) {
        const {
            createBackups = true,
            cleanupExtracted = true,
            extractDir = path.join(path.dirname(asarPath), 'unpacked-asar')
        } = options;

        try {
            this.executablePath = executablePath;
            this.asarPath = asarPath;
            
            // Extract current hash from binary
            const currentHash = this.extractHashFromBinary(executablePath);
            if (!currentHash) {
                throw new Error('Could not find current hash in binary');
            }
            
            // Verify current ASAR hash
            const currentAsarHash = this.calculateAsarHash(asarPath);
            
            // Extract ASAR
            this.extractAsar(asarPath, extractDir);
            
            // Apply modifications if callback provided
            if (modificationsCallback && typeof modificationsCallback === 'function') {
                await modificationsCallback(extractDir);
            }
            
            // Repack ASAR
            this.packAsar(extractDir, asarPath, createBackups);
            
            // Calculate new hash
            const newHash = this.calculateAsarHash(asarPath);
            
            // Replace hash in binary
            const hashReplaced = this.replaceHashInBinary(executablePath, currentHash, newHash, createBackups);
            
            // Clean up if requested
            if (cleanupExtracted && fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true, force: true });
            }
            
            return {
                success: hashReplaced,
                oldHash: currentHash,
                newHash: newHash,
                asarModified: currentHash !== currentAsarHash,
                backupsCreated: createBackups
            };
            
        } catch (error) {
            throw new Error(`Bypass failed: ${error.message}`);
        }
    }

    /**
     * Restore from backups
     * @param {string} executablePath - Path to executable
     * @param {string} asarPath - Path to ASAR file
     * @returns {Object} - Restore result
     */
    restoreFromBackups(executablePath, asarPath) {
        const result = {
            executableRestored: false,
            asarRestored: false
        };

        try {
            // Restore executable
            const execBackup = executablePath + '.backup';
            if (fs.existsSync(execBackup)) {
                fs.copyFileSync(execBackup, executablePath);
                result.executableRestored = true;
            }

            // Restore ASAR
            const asarBackup = asarPath + '.backup';
            if (fs.existsSync(asarBackup)) {
                fs.copyFileSync(asarBackup, asarPath);
                result.asarRestored = true;
            }

            return result;
        } catch (error) {
            throw new Error(`Restore failed: ${error.message}`);
        }
    }
}

module.exports = ElectronIntegrityBypass;