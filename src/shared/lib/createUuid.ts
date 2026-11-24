let uuidCounter = 0;

export const createUuid = () => {
  const cryptoApi = globalThis.crypto as Crypto | undefined;

  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }

  uuidCounter = (uuidCounter + 1) % Number.MAX_SAFE_INTEGER;
  const timePart = Date.now().toString(36);
  const randomPart = Math.random().toString(36).slice(2, 10);

  return `uuid-${timePart}-${randomPart}-${uuidCounter.toString(36)}`;
};

