import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
} from "node:crypto";

const PREFIX = "enc:v1:";

function getEncryptionKey() {
    const raw = process.env.APP_ENCRYPTION_KEY?.trim();
    if (!raw) {
        throw new Error("Missing APP_ENCRYPTION_KEY");
    }

    return createHash("sha256").update(raw).digest();
}

export function encryptSecret(value: string) {
    const key = getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSecret(value: string) {
    if (!value.startsWith(PREFIX)) {
        return value;
    }

    const key = getEncryptionKey();
    const payload = value.slice(PREFIX.length);
    const [ivBase64, tagBase64, encryptedBase64] = payload.split(".");

    if (!ivBase64 || !tagBase64 || !encryptedBase64) {
        throw new Error("Invalid encrypted payload format");
    }

    const iv = Buffer.from(ivBase64, "base64");
    const tag = Buffer.from(tagBase64, "base64");
    const encrypted = Buffer.from(encryptedBase64, "base64");

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
    ]);

    return decrypted.toString("utf8");
}
