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

    
    extractHashFromBinary(executablePath) {
        try {
            
            const binaryContent = fs.readFileSync(executablePath, 'utf8');
            
            
            const hashPattern = /"alg":"SHA256","value":"([a-f0-9]{64})"/g;
            const match = hashPattern.exec(binaryContent);
            
            if (match) {
                this.currentHash = match[1];
                return this.currentHash;
            }
            
            
            try {
                const stringsOutput = execSync(`strings "${executablePath}" | grep '"alg":"SHA256"'`, { encoding: 'utf8' });
                const stringsMatch = /"value":"([a-f0-9]{64})"/.exec(stringsOutput);
                if (stringsMatch) {
                    this.currentHash = stringsMatch[1];
                    return this.currentHash;
                }
            } catch (e) {
                
            }
            
            return null;
        } catch (error) {
            throw new Error(`Error extracting hash from binary: ${error.message}`);
        }
    }

    
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

    
    extractAsar(asarPath, outputDir) {
        try {
            
            if (fs.existsSync(outputDir)) {
                fs.rmSync(outputDir, { recursive: true, force: true });
            }
            
            asar.extractAll(asarPath, outputDir);
            return true;
        } catch (error) {
            throw new Error(`Error extracting ASAR: ${error.message}`);
        }
    }

    
    packAsar(sourceDir, asarPath, createBackup = true) {
        try {
            
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

    
    replaceHashInBinary(executablePath, oldHash, newHash, createBackup = true) {
        try {
            
            if (createBackup) {
                const backupPath = executablePath + '.backup';
                if (!fs.existsSync(backupPath)) {
                    fs.copyFileSync(executablePath, backupPath);
                }
            }
            
            
            let binaryContent = fs.readFileSync(executablePath);
            
            
            const oldHashBuffer = Buffer.from(oldHash, 'utf8');
            const newHashBuffer = Buffer.from(newHash, 'utf8');
            
            
            const oldIndex = binaryContent.indexOf(oldHashBuffer);
            if (oldIndex === -1) {
                return false;
            }
            
            
            newHashBuffer.copy(binaryContent, oldIndex);
            
            
            fs.writeFileSync(executablePath, binaryContent);
            return true;
        } catch (error) {
            throw new Error(`Error replacing hash in binary: ${error.message}`);
        }
    }

    
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
            
            
            setTimeout(() => {
                if (!child.killed) {
                    child.kill();
                }
            }, timeout);
        });
    }

    
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

    
    async bypassIntegrity(executablePath, asarPath, modificationsCallback = null, options = {}) {
        const {
            createBackups = true,
            cleanupExtracted = true,
            extractDir = path.join(path.dirname(asarPath), 'unpacked-asar')
        } = options;

        try {
            this.executablePath = executablePath;
            this.asarPath = asarPath;
            
            
            const currentHash = this.extractHashFromBinary(executablePath);
            if (!currentHash) {
                throw new Error('Could not find current hash in binary');
            }
            
            
            const currentAsarHash = this.calculateAsarHash(asarPath);
            
            
            this.extractAsar(asarPath, extractDir);
            
            
            if (modificationsCallback && typeof modificationsCallback === 'function') {
                await modificationsCallback(extractDir);
            }
            
            
            this.packAsar(extractDir, asarPath, createBackups);
            
            
            const newHash = this.calculateAsarHash(asarPath);
            
            
            const hashReplaced = this.replaceHashInBinary(executablePath, currentHash, newHash, createBackups);
            
            
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

    
    restoreFromBackups(executablePath, asarPath) {
        const result = {
            executableRestored: false,
            asarRestored: false
        };

        try {
            
            const execBackup = executablePath + '.backup';
            if (fs.existsSync(execBackup)) {
                fs.copyFileSync(execBackup, executablePath);
                result.executableRestored = true;
            }

            
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