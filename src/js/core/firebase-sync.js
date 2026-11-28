/**
 * Refaey Farm Tracker - Firebase Cloud Firestore Sync Module
 * Syncs cycles & transactions across devices while preserving localStorage offline-first safety.
 */
(function initFirebaseCloudSync() {
  const firebaseConfig = {
    apiKey: 'AIzaSyCLIXn-VKZo5-HWuWpPBMWFfDc83e7hVLQ',
    authDomain: 'refaey-farm-tracker-2026.firebaseapp.com',
    projectId: 'refaey-farm-tracker-2026',
    storageBucket: 'refaey-farm-tracker-2026.firebasestorage.app',
    messagingSenderId: '1064230940639',
    appId: '1:1064230940639:web:2d5c13e534737d42a69e6a'
  };

  if (typeof firebase === 'undefined' || !firebase.firestore) {
    console.warn('Firebase SDK not loaded; running in local-only mode.');
    return;
  }

  const app = firebase.apps && firebase.apps.length > 0
    ? firebase.app()
    : firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore(app);

  // Best-effort Firestore offline cache (localStorage remains the primary instant cache)
  try {
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch (e) {
    // Ignore persistence errors in private/restricted browsers
  }

  const CYCLES_COL = 'cycles';
  const META_COL = 'app_meta';
  const META_DOC = 'state';

  let initialHydrationDone = false;
  let knownRemoteCycleIds = new Set();
  let lastSyncedJson = '';
  let writeChain = Promise.resolve();
  let unsubscribeSnapshot = null;

  function stripFirestoreMeta(rawDoc) {
    if (!rawDoc || typeof rawDoc !== 'object') return rawDoc;
    const copy = { ...rawDoc };
    delete copy._updatedAt;
    delete copy._updatedMs;
    return copy;
  }

  function sanitizeForFirestore(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sortCycles(cycles, orderedIds) {
    const list = [...cycles];
    if (Array.isArray(orderedIds) && orderedIds.length > 0) {
      const rank = new Map(orderedIds.map((id, idx) => [String(id), idx]));
      list.sort((a, b) => {
        const ra = rank.has(String(a.id)) ? rank.get(String(a.id)) : Number.MAX_SAFE_INTEGER;
        const rb = rank.has(String(b.id)) ? rank.get(String(b.id)) : Number.MAX_SAFE_INTEGER;
        if (ra !== rb) return ra - rb;
        return (+a.id || 0) - (+b.id || 0);
      });
    } else {
      list.sort((a, b) => (+a.id || 0) - (+b.id || 0));
    }
    return list;
  }

  async function writeCyclesBatch(cycles) {
    const cleanCycles = sanitizeForFirestore(Array.isArray(cycles) ? cycles : []);
    const currentIds = new Set(cleanCycles.map(c => String(c.id)));
    const batch = db.batch();

    cleanCycles.forEach(cycle => {
      const docRef = db.collection(CYCLES_COL).doc(String(cycle.id));
      batch.set(docRef, {
        ...cycle,
        _updatedMs: Date.now(),
        _updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    knownRemoteCycleIds.forEach(oldId => {
      if (!currentIds.has(oldId)) {
        batch.delete(db.collection(CYCLES_COL).doc(oldId));
      }
    });

    const metaRef = db.collection(META_COL).doc(META_DOC);
    batch.set(metaRef, {
      cycleIds: cleanCycles.map(c => String(c.id)),
      updatedMs: Date.now(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    knownRemoteCycleIds = currentIds;
    lastSyncedJson = JSON.stringify(normalizeData(cleanCycles));
  }

  function pushCyclesToFirestore(cycles) {
    if (!initialHydrationDone) {
      return Promise.reject(new Error('Initial Firestore sync not ready yet'));
    }
    const snapshotCycles = sanitizeForFirestore(cycles);
    writeChain = writeChain
      .catch(() => {})
      .then(() => writeCyclesBatch(snapshotCycles));
    return writeChain;
  }

  // Register hook before hydration so offline edits made during startup queue as pending
  if (typeof setCloudSyncHandler === 'function') {
    setCloudSyncHandler(pushCyclesToFirestore);
  }

  function startRealtimeListener() {
    if (unsubscribeSnapshot) return;
    unsubscribeSnapshot = db.collection(CYCLES_COL).onSnapshot(
      async snapshot => {
        if (!initialHydrationDone || snapshot.metadata.hasPendingWrites) return;

        let orderedIds = null;
        try {
          const metaSnap = await db.collection(META_COL).doc(META_DOC).get();
          if (metaSnap.exists && Array.isArray(metaSnap.data()?.cycleIds)) {
            orderedIds = metaSnap.data().cycleIds;
          }
        } catch (e) {
          // Fallback to id sort
        }

        const remoteCycles = sortCycles(
          snapshot.docs.map(doc => stripFirestoreMeta(doc.data())),
          orderedIds
        );
        knownRemoteCycleIds = new Set(snapshot.docs.map(doc => doc.id));

        const normalizedJson = JSON.stringify(normalizeData(JSON.parse(JSON.stringify(remoteCycles))));
        if (normalizedJson === lastSyncedJson) return;

        lastSyncedJson = normalizedJson;
        if (typeof applyRemoteCycles === 'function' && applyRemoteCycles(remoteCycles)) {
          if (typeof showToast === 'function') {
            showToast('☁️ تم تحديث البيانات من السحابة');
          }
        }
      },
      err => {
        console.warn('Firestore realtime listener error:', err);
      }
    );
  }

  async function hydrateFromFirestore() {
    try {
      const [cyclesSnap, metaSnap] = await Promise.all([
        db.collection(CYCLES_COL).get(),
        db.collection(META_COL).doc(META_DOC).get()
      ]);

      const orderedIds = metaSnap.exists && Array.isArray(metaSnap.data()?.cycleIds)
        ? metaSnap.data().cycleIds
        : null;

      knownRemoteCycleIds = new Set(cyclesSnap.docs.map(doc => doc.id));
      const remoteCycles = sortCycles(
        cyclesSnap.docs.map(doc => stripFirestoreMeta(doc.data())),
        orderedIds
      );

      if (typeof hasPendingSync !== 'undefined' && hasPendingSync && typeof hasLocalSavedData !== 'undefined' && hasLocalSavedData) {
        initialHydrationDone = true;
        await pushCyclesToFirestore(C);
        if (typeof clearPendingSync === 'function') clearPendingSync();
      } else if (remoteCycles.length > 0 || metaSnap.exists) {
        lastSyncedJson = JSON.stringify(normalizeData(JSON.parse(JSON.stringify(remoteCycles))));
        if (typeof applyRemoteCycles === 'function') {
          applyRemoteCycles(remoteCycles);
        }
        initialHydrationDone = true;
      } else {
        // First-ever connection: only seed Firestore if the user actually has cycles
        initialHydrationDone = true;
        if (Array.isArray(C) && C.length > 0) {
          await pushCyclesToFirestore(C);
        }
        if (typeof clearPendingSync === 'function') clearPendingSync();
      }

      startRealtimeListener();
    } catch (err) {
      console.warn('Initial Firestore hydration failed; keeping local cache:', err);
      if (typeof markPendingSync === 'function' && typeof hasLocalSavedData !== 'undefined' && hasLocalSavedData) {
        markPendingSync();
      }
    }
  }

  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    hydrateFromFirestore();
  }

  window.addEventListener('online', () => {
    if (!initialHydrationDone) {
      hydrateFromFirestore();
    }
  });
})();
