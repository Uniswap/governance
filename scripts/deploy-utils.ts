export function getEnv(key: string, defaultValue?: string): string {
    const value = process.env[key] || defaultValue;
    if (value === undefined) {
      throw new Error(`Missing environment variable: ${key}`);
    }
    return value;
  }
  

export function getEnvList(key: string, defaultValue?: string): string[] {
const value = process.env[key] || defaultValue;
if (value === undefined) {
    throw new Error(`Missing environment variable: ${key}`);
}
return value.split(",");
}