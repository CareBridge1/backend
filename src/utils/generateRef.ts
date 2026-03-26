import { v4 as uuidv4 } from 'uuid';

export const generateRef = (): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
  return `CNP-${timestamp}-${random}`;
};
