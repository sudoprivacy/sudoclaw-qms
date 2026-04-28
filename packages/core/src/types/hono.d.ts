import type { User } from './auth.js';
import type { DecryptedBatchRequest } from './encryption.js';

declare module 'hono' {
  interface ContextVariableMap {
    user: User;
    userId: string;
    userRole: string;
    decryptedBody: DecryptedBatchRequest;
    wasEncrypted: boolean;
  }
}