import { DevToolsControl, GetProcessInfo, GetAppInfo, GetGlobalVariables, GetReduxState, GetWindowInfo, GetLocalStorage, EnumerateIPC, GetDependencies, GetCSP } from './payloads';

const payloads = [
  DevToolsControl,
  GetProcessInfo,
  GetAppInfo,
  GetGlobalVariables,
  GetReduxState,
  GetWindowInfo,
  GetLocalStorage,
  EnumerateIPC,
  GetDependencies,
  GetCSP
];

/**
 * Generic payload templating utility
 * @param {string} template - The template string with {{ VAR }} placeholders
 * @param {object} variables - An object with keys matching the template variables
 * @returns {string} - The templated string
 */
export function templatePayload(template, variables) {
  return template.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(variables, key) ? variables[key] : match;
  });
}

export default payloads;