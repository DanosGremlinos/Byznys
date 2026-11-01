// Usage: npm run hash-password -- 'your-password'
// Prints the value for ADMIN_PASSWORD_HASH. The password itself is never stored or logged.
import { hashPassword } from "../src/lib/password";

const password = process.argv[2];
if (!password) {
  console.error("Usage: npm run hash-password -- '<password>'");
  process.exit(1);
}
hashPassword(password).then((hash) => console.log(hash));
