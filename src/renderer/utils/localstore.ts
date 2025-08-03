export type LastScanned = Date | null;

export const getItem = <T>(key: string): T | null => {
  const item = localStorage.getItem(key);
  if (item) {
    return JSON.parse(item);
  }
  return null;
};

export const setOrUpdateItem = <T>(key: string, value: T): void => {
  localStorage.setItem(key, JSON.stringify(value));
};

export const removeItem = (key: string): void => {
  localStorage.removeItem(key);
};
