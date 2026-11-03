import {
  db,
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  addDoc
} from "./firebase.js";

/**
 * Lista todos os usuários com filtros opcionais.
 */
export async function listUsers(filters = {}) {
  const usersRef = collection(db, "users");
  let q = query(usersRef, orderBy("createdAt", "desc"));

  if (filters.status) {
    q = query(usersRef, where("status", "==", filters.status), orderBy("createdAt", "desc"));
  }

  if (filters.role) {
    q = query(usersRef, where("role", "==", filters.role), orderBy("createdAt", "desc"));
  }

  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
}

/**
 * Atualiza o status de um usuário (admin only).
 * Registra ação em auditLog.
 */
export async function updateUserStatus(adminUid, targetUid, newStatus, reason = "") {
  if (!["approved", "rejected", "suspended"].includes(newStatus)) {
    throw new Error("Status inválido");
  }

  const updates = {
    status: newStatus,
    updatedAt: serverTimestamp()
  };

  if (newStatus === "approved") {
    updates.approvedAt = serverTimestamp();
    updates.approvedBy = adminUid;
  }

  await updateDoc(doc(db, "users", targetUid), updates);

  // Registra no audit log
  await addDoc(collection(db, "auditLog"), {
    actorId: adminUid,
    action: `user_status_change`,
    targetType: "user",
    targetId: targetUid,
    metadata: {
      newStatus,
      reason: reason || null
    },
    timestamp: serverTimestamp()
  });
}

/**
 * Atualiza o role de um usuário (admin only).
 * Registra ação em auditLog.
 */
export async function updateUserRole(adminUid, targetUid, newRole) {
  if (!["student", "professor", "admin"].includes(newRole)) {
    throw new Error("Role inválido");
  }

  await updateDoc(doc(db, "users", targetUid), {
    role: newRole,
    updatedAt: serverTimestamp()
  });

  // Sincroniza com publicProfiles
  const publicRef = doc(db, "publicProfiles", targetUid);
  const publicSnap = await getDoc(publicRef);

  if (publicSnap.exists()) {
    await updateDoc(publicRef, {
      role: newRole,
      updatedAt: serverTimestamp()
    });
  }

  // Registra no audit log
  await addDoc(collection(db, "auditLog"), {
    actorId: adminUid,
    action: "user_role_change",
    targetType: "user",
    targetId: targetUid,
    metadata: { newRole },
    timestamp: serverTimestamp()
  });
}

/**
 * Busca logs de auditoria (admin only).
 */
export async function getAuditLogs(limitCount = 50) {
  const logsRef = collection(db, "auditLog");
  const q = query(logsRef, orderBy("timestamp", "desc"));

  const snap = await getDocs(q);
  return snap.docs.slice(0, limitCount).map(doc => ({ id: doc.id, ...doc.data() }));
}
