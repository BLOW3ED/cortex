import Dexie, { type DexieOptions } from "dexie";
import { IDBFactory, IDBKeyRange } from "fake-indexeddb";

/** Una IndexedDB en memoria nueva por prueba (sin estado compartido entre pruebas). */
export function freshIdb(): DexieOptions & { indexedDB: IDBFactory } {
  return { indexedDB: new IDBFactory(), IDBKeyRange };
}

/** Fotografía del esquema nativo: versión, tablas e índices. */
export async function nativeSnapshot(options: DexieOptions, name = "cortex") {
  const db = new Dexie(name, options);
  await db.open();
  const idb = db.backendDB();
  const tx = idb.transaction([...idb.objectStoreNames], "readonly");
  const stores = Object.fromEntries(
    [...idb.objectStoreNames].map((s) => {
      const store = tx.objectStore(s);
      return [s, { keyPath: store.keyPath, autoIncrement: store.autoIncrement, indexes: [...store.indexNames].sort() }];
    }),
  );
  const counts = Object.fromEntries(await Promise.all(db.tables.map(async (t) => [t.name, await t.count()] as const)));
  const version = idb.version;
  db.close();
  return { version, stores, counts };
}
