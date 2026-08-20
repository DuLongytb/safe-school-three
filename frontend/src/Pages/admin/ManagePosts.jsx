import React, { useState, useEffect } from "react";
import { getPosts, approvePost, deletePost } from "../../api/admin";
import Modal from "../../components/Common/Modal";
import Toast from "../../components/Common/Toast";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { deleteArticleCascadeService } from "../../services/articleService";

const VIOLENCE_KEYWORDS = [
    "bạo lực",
    "đánh",
    "bắt nạt",
    "đe dọa",
    "hành hung",
    "xúc phạm",
    "nhổn",
    "chửi",
];

const ManagePosts = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;

    // Modal States
    const [selectedPost, setSelectedPost] = useState(null);
    const [actionType, setActionType] = useState(null); // 'approved' | 'rejected' | 'delete'
    const [showModal, setShowModal] = useState(false);

    const [toast, setToast] = useState({ message: "", type: "info" });

    const [previewPost, setPreviewPost] = useState(null);

    const fetchPostsList = async () => {
        try {
            setLoading(true);
            setError(null);
            // Try API first
            const res = await getPosts(statusFilter).catch(() => null);
            if (res && res.data && res.data.length > 0) {
                setPosts(res.data);
            } else {
                // Direct Firestore fallback from 'articles' collection
                const articlesRef = collection(db, "articles");
                let q = query(articlesRef, where("isDeleted", "!=", true));
                if (statusFilter !== "all") {
                    q = query(articlesRef, where("isDeleted", "!=", true), where("status", "==", statusFilter));
                }
                const snap = await getDocs(q);
                let fetched = snap.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                    createdAt: docSnap.data().createdAt?.toDate ? docSnap.data().createdAt.toDate().toISOString() : docSnap.data().createdAt || new Date().toISOString(),
                }));
                fetched.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setPosts(fetched);
            }
        } catch (err) {
            console.error("Lỗi lấy bài viết:", err);
            setError(err.message || "Không thể tải danh sách bài viết");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPostsList();
    }, [statusFilter]);

    // Mở modal Duyệt, Từ chối hoặc Xóa
    const handleOpenActionModal = (post, type) => {
        setSelectedPost(post);
        setActionType(type);
        setShowModal(true);
    };

    const handleDeletePost = async () => {
        if (!selectedPost) return;

        try {
            const postId = selectedPost.id || selectedPost.postId || selectedPost._id;
            await deletePost(postId);

            setToast({
                message: `Đã xóa bài viết "${selectedPost.title || "Bài viết"}" thành công!`,
                type: "success",
            });

            setShowModal(false);
            setSelectedPost(null);
            setActionType(null);
            fetchPostsList();
        } catch (err) {
            setToast({
                message: "Lỗi khi xóa bài viết: " + err.message,
                type: "error",
            });
        }
    };

    // Xác nhận Duyệt hoặc Từ chối bài viết
    const handleConfirmAction = async (reasonInput) => {
        if (!selectedPost || !actionType) return;

        if (actionType === "delete") {
            await handleDeletePost();
            return;
        }

        try {
            // Update in Firestore 'articles' doc directly for instant sync
            const docRef = doc(db, "articles", selectedPost.id);
            const nowIso = new Date().toISOString();
            const updatePayload = {
                status: actionType,
                // approved → public, rejected → private
                visibility: actionType === "approved" ? "public" : "private",
                reviewedBy: "admin",
                reviewedAt: nowIso,
                moderatedBy: "admin",
                moderatedAt: nowIso,
                updatedAt: serverTimestamp(),
            };
            if (actionType === "rejected") {
                updatePayload.rejectionReason = reasonInput || "";
                updatePayload.reason = reasonInput || "";
            }

            await updateDoc(docRef, updatePayload).catch(err => console.log("Firestore update fallback info:", err));

            // Also call API if available
            await approvePost(selectedPost.id, {
                status: actionType,
                reason: reasonInput || "",
            }).catch(() => { });

            const actionText = actionType === "approved" ? "duyệt" : "từ chối";
            setToast({
                message: `Đã ${actionText} bài viết "${selectedPost.title || "Bài viết"}" thành công!`,
                type: actionType === "approved" ? "success" : "warning",
            });

            setShowModal(false);
            setSelectedPost(null);
            setActionType(null);
            fetchPostsList();
        } catch (err) {
            setToast({
                message: "Lỗi khi xử lý bài viết: " + err.message,
                type: "error",
            });
        }
    };

    // Kiểm tra bài viết có chứa từ khóa bạo lực nhạy cảm không
    const hasViolenceKeyword = (post) => {
        const text = `${post.title || ""} ${post.content || ""}`.toLowerCase();
        return VIOLENCE_KEYWORDS.some((kw) => text.includes(kw));
    };

    // Format ngày tháng
    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        try {
            const d = new Date(dateStr);
            return d.toLocaleString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            });
        } catch {
            return dateStr;
        }
    };

    // Lọc bài viết theo tìm kiếm
    const filteredPosts = posts.filter((p) => {
        const titleMatch = (p.title || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        const authorMatch = (p.authorName || p.authorId || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        return titleMatch || authorMatch;
    });

    const totalPages = Math.ceil(filteredPosts.length / itemsPerPage) || 1;
    const paginatedPosts = filteredPosts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage,
    );

    return (
        <div>
            <Toast
                message={toast.message}
                type={toast.type}
                onClose={() => setToast({ message: "", type: "info" })}
            />

            {/* Confirmation Modal */}
            <Modal
                isOpen={showModal}
                title={
                    actionType === "approved"
                        ? "✅ Xác Nhận Duyệt Bài Viết"
                        : actionType === "rejected"
                            ? "❌ Từ Chối Bài Viết"
                            : "🗑️ Xác Nhận Xóa Bài Viết"
                }
                message={
                    actionType === "approved"
                        ? `Bạn có chắc chắn muốn DUYỆT bài viết "${selectedPost?.title}" để đăng lên diễn đàn công khai không?`
                        : actionType === "rejected"
                            ? `Nhập lý do từ chối bài viết "${selectedPost?.title}". Thông báo sẽ được tự động gửi đến tác giả.`
                            : `Bạn có chắc chắn muốn XÓA bài viết "${selectedPost?.title}" khỏi hệ thống? Hành động này không thể hoàn tác.`
                }
                variant={actionType === "approved" ? "success" : actionType === "rejected" ? "danger" : "danger"}
                inputPlaceholder={
                    actionType === "rejected"
                        ? "Nhập lý do từ chối (ví dụ: Vi phạm quy chuẩn nội dung)..."
                        : ""
                }
                requireInput={actionType === "rejected"}
                confirmText={
                    actionType === "approved"
                        ? "Đồng Ý Duyệt"
                        : actionType === "rejected"
                            ? "Từ Chối Bài"
                            : "Xác Nhận Xóa"
                }
                cancelText="Hủy Bỏ"
                onConfirm={handleConfirmAction}
                onCancel={() => {
                    setShowModal(false);
                    setSelectedPost(null);
                    setActionType(null);
                }}
            />

            {/* Header Title */}
            <div style={{ marginBottom: "24px" }}>
                <h1
                    style={{
                        margin: 0,
                        fontSize: "1.8rem",
                        color: "#0f172a",
                        fontWeight: "700",
                    }}
                >
                    📰 Quản Lý & Kiểm Duyệt Bài Viết
                </h1>
                <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "0.95rem" }}>
                    Tự động phát hiện bài viết chứa từ khóa nhạy cảm, duyệt bài và gửi
                    thông báo tự động
                </p>
            </div>

            {/* Control Bar: Search & Status Filter */}
            <div
                style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "12px",
                    padding: "16px 20px",
                    marginBottom: "24px",
                    border: "1px solid #e2e8f0",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "16px",
                    justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                }}
            >
                {/* Search */}
                <div style={{ position: "relative", flex: "1", minWidth: "260px" }}>
                    <span
                        style={{
                            position: "absolute",
                            left: "12px",
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: "#94a3b8",
                        }}
                    >
                        🔍
                    </span>
                    <input
                        type="text"
                        placeholder="Tìm kiếm bài viết theo tiêu đề, tác giả..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                        }}
                        style={{
                            width: "100%",
                            padding: "10px 14px 10px 38px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.9rem",
                            outline: "none",
                            boxSizing: "border-box",
                        }}
                    />
                </div>

                {/* Filter Dropdown */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <label
                        style={{ fontSize: "0.9rem", fontWeight: "600", color: "#475569" }}
                    >
                        Trạng Thái:
                    </label>
                    <select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value);
                            setCurrentPage(1);
                        }}
                        style={{
                            padding: "10px 14px",
                            borderRadius: "8px",
                            border: "1px solid #cbd5e1",
                            fontSize: "0.9rem",
                            backgroundColor: "#ffffff",
                            cursor: "pointer",
                            outline: "none",
                        }}
                    >
                        <option value="all">Tất cả bài viết</option>
                        <option value="pending">Chờ duyệt (Pending)</option>
                        <option value="approved">Đã duyệt (Approved)</option>
                        <option value="rejected">Đã từ chối (Rejected)</option>
                    </select>
                </div>
            </div>

            {/* Loading state */}
            {loading && (
                <div style={{ textAlign: "center", padding: "40px" }}>
                    <span style={{ fontSize: "2rem" }}>⏳</span>
                    <p style={{ color: "#64748b", marginTop: "8px" }}>
                        Đang tải danh sách bài viết...
                    </p>
                </div>
            )}

            {/* Error state */}
            {error && !loading && (
                <div
                    style={{
                        backgroundColor: "#fef2f2",
                        border: "1px solid #fecaca",
                        padding: "20px",
                        borderRadius: "10px",
                        textAlign: "center",
                    }}
                >
                    <p style={{ color: "#dc2626", margin: "0 0 12px" }}>⚠️ {error}</p>
                    <button
                        onClick={fetchPostsList}
                        style={{
                            padding: "8px 16px",
                            backgroundColor: "#dc2626",
                            color: "#fff",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                        }}
                    >
                        🔄 Thử lại
                    </button>
                </div>
            )}

            {/* Posts Table */}
            {!loading && !error && (
                <div
                    style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0",
                        overflow: "hidden",
                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
                    }}
                >
                    <table
                        style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            textAlign: "left",
                            fontSize: "0.9rem",
                        }}
                    >
                        <thead>
                            <tr
                                style={{
                                    backgroundColor: "#f8fafc",
                                    borderBottom: "1px solid #e2e8f0",
                                    color: "#475569",
                                    fontWeight: "600",
                                }}
                            >
                                <th style={{ padding: "14px 20px" }}>Tiêu Đề Bài Viết</th>
                                <th style={{ padding: "14px 20px" }}>Tác Giả</th>
                                <th style={{ padding: "14px 20px" }}>Trạng Thái</th>
                                <th style={{ padding: "14px 20px" }}>Ngày Tạo</th>
                                <th style={{ padding: "14px 20px", textAlign: "right" }}>
                                    Thao Tác Duyệt
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPosts.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={5}
                                        style={{
                                            padding: "32px",
                                            textAlign: "center",
                                            color: "#94a3b8",
                                        }}
                                    >
                                        Không có bài viết nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                paginatedPosts.map((p) => {
                                    const isViolence = hasViolenceKeyword(p);
                                    const isPending = (p.status || "pending") === "pending";
                                    const isApproved = p.status === "approved";
                                    const isRejected = p.status === "rejected";

                                    return (
                                        <tr
                                            key={p.id}
                                            style={{
                                                borderBottom: "1px solid #f1f5f9",
                                                backgroundColor: isViolence ? "#fffbe6" : "transparent",
                                                transition: "background-color 0.15s",
                                            }}
                                        >
                                            {/* Title & Warning Tag */}
                                            <td style={{ padding: "14px 20px", maxWidth: "320px" }}>
                                                <div
                                                    style={{
                                                        fontWeight: "600",
                                                        color: "#0f172a",
                                                        marginBottom: "4px",
                                                    }}
                                                >
                                                    {p.title || "Bài viết không tiêu đề"}
                                                </div>

                                                {/* Highlight Violence Keyword */}
                                                {isViolence && (
                                                    <span
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            backgroundColor: "#fef3c7",
                                                            color: "#b45309",
                                                            border: "1px solid #fde68a",
                                                            padding: "2px 8px",
                                                            borderRadius: "4px",
                                                            fontSize: "0.75rem",
                                                            fontWeight: "600",
                                                        }}
                                                    >
                                                        ⚠️ Nghi vấn chứa từ khóa bạo lực!
                                                    </span>
                                                )}
                                            </td>

                                            {/* Author */}
                                            <td style={{ padding: "14px 20px", color: "#334155" }}>
                                                {p.authorName || p.authorId || "Học sinh ẩn danh"}
                                            </td>

                                            {/* Status */}
                                            <td style={{ padding: "14px 20px" }}>
                                                {isApproved && (
                                                    <span
                                                        style={{
                                                            backgroundColor: "#dcfce7",
                                                            color: "#15803d",
                                                            padding: "4px 12px",
                                                            borderRadius: "12px",
                                                            fontSize: "0.8rem",
                                                            fontWeight: "600",
                                                        }}
                                                    >
                                                        ✅ Đã duyệt
                                                    </span>
                                                )}
                                                {isRejected && (
                                                    <span
                                                        style={{
                                                            backgroundColor: "#fee2e2",
                                                            color: "#b91c1c",
                                                            padding: "4px 12px",
                                                            borderRadius: "12px",
                                                            fontSize: "0.8rem",
                                                            fontWeight: "600",
                                                        }}
                                                    >
                                                        ❌ Đã từ chối
                                                    </span>
                                                )}
                                                {isPending && (
                                                    <span
                                                        style={{
                                                            backgroundColor: "#fef3c7",
                                                            color: "#b45309",
                                                            padding: "4px 12px",
                                                            borderRadius: "12px",
                                                            fontSize: "0.8rem",
                                                            fontWeight: "600",
                                                        }}
                                                    >
                                                        ⏳ Chờ duyệt
                                                    </span>
                                                )}
                                            </td>

                                            {/* Date */}
                                            <td
                                                style={{
                                                    padding: "14px 20px",
                                                    color: "#64748b",
                                                    fontSize: "0.85rem",
                                                }}
                                            >
                                                {formatDate(p.createdAt)}
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: "14px 20px", textAlign: "right" }}>
                                                <div
                                                    style={{
                                                        display: "flex",
                                                        gap: "8px",
                                                        justifyContent: "flex-end",
                                                    }}
                                                >
                                                    <button
                                                        onClick={() => setPreviewPost(p)}
                                                        style={{
                                                            padding: "6px 12px",
                                                            borderRadius: "6px",
                                                            border: "1px solid #cbd5e1",
                                                            backgroundColor: "#ffffff",
                                                            color: "#475569",
                                                            fontWeight: "600",
                                                            fontSize: "0.825rem",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        👁️ Xem
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenActionModal(p, "approved")}
                                                        disabled={isApproved}
                                                        style={{
                                                            padding: "6px 12px",
                                                            borderRadius: "6px",
                                                            border: "none",
                                                            backgroundColor: isApproved
                                                                ? "#e2e8f0"
                                                                : "#16a34a",
                                                            color: isApproved ? "#94a3b8" : "#ffffff",
                                                            fontWeight: "600",
                                                            fontSize: "0.825rem",
                                                            cursor: isApproved ? "default" : "pointer",
                                                        }}
                                                    >
                                                        ✅ Duyệt
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenActionModal(p, "rejected")}
                                                        disabled={isRejected}
                                                        style={{
                                                            padding: "6px 12px",
                                                            borderRadius: "6px",
                                                            border: "none",
                                                            backgroundColor: isRejected
                                                                ? "#e2e8f0"
                                                                : "#dc2626",
                                                            color: isRejected ? "#94a3b8" : "#ffffff",
                                                            fontWeight: "600",
                                                            fontSize: "0.825rem",
                                                            cursor: isRejected ? "default" : "pointer",
                                                        }}
                                                    >
                                                        ❌ Từ chối
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenActionModal(p, "delete")}
                                                        style={{
                                                            padding: "6px 12px",
                                                            borderRadius: "6px",
                                                            border: "none",
                                                            backgroundColor: "#7c3aed",
                                                            color: "#ffffff",
                                                            fontWeight: "600",
                                                            fontSize: "0.825rem",
                                                            cursor: "pointer",
                                                        }}
                                                    >
                                                        🗑️ Xóa
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div
                            style={{
                                padding: "16px 20px",
                                borderTop: "1px solid #e2e8f0",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                                Trang {currentPage} / {totalPages} (Tổng {filteredPosts.length}{" "}
                                bài viết)
                            </span>

                            <div style={{ display: "flex", gap: "6px" }}>
                                <button
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage((p) => p - 1)}
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid #cbd5e1",
                                        backgroundColor: currentPage === 1 ? "#f1f5f9" : "#ffffff",
                                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                                    }}
                                >
                                    ◀ Trước
                                </button>
                                <button
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage((p) => p + 1)}
                                    style={{
                                        padding: "6px 12px",
                                        borderRadius: "6px",
                                        border: "1px solid #cbd5e1",
                                        backgroundColor:
                                            currentPage === totalPages ? "#f1f5f9" : "#ffffff",
                                        cursor:
                                            currentPage === totalPages ? "not-allowed" : "pointer",
                                    }}
                                >
                                    Sau ▶
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Preview Post Modal */}
            {previewPost && (
                <div
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: "rgba(15, 23, 42, 0.6)",
                        backdropFilter: "blur(4px)",
                        zIndex: 999,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px",
                    }}
                    onClick={() => setPreviewPost(null)}
                >
                    <div
                        style={{
                            backgroundColor: "#ffffff",
                            borderRadius: "12px",
                            maxWidth: "680px",
                            width: "100%",
                            maxHeight: "85vh",
                            overflowY: "auto",
                            padding: "24px",
                            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)",
                            position: "relative",
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                marginBottom: "16px",
                                borderBottom: "1px solid #e2e8f0",
                                paddingBottom: "12px",
                            }}
                        >
                            <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a" }}>
                                📰 Xem Nội Dung Bài Viết
                            </h3>
                            <button
                                onClick={() => setPreviewPost(null)}
                                style={{
                                    border: "none",
                                    background: "none",
                                    fontSize: "1.4rem",
                                    cursor: "pointer",
                                    color: "#64748b",
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        <h2 style={{ margin: "0 0 8px 0", color: "#0f172a", fontSize: "1.3rem" }}>
                            {previewPost.title}
                        </h2>
                        <div
                            style={{
                                display: "flex",
                                gap: "12px",
                                fontSize: "0.85rem",
                                color: "#64748b",
                                marginBottom: "16px",
                            }}
                        >
                            <span>✍️ {previewPost.authorName || previewPost.authorId || "Tác giả"}</span>
                            <span>🏷️ {previewPost.category || "Chưa phân loại"}</span>
                            <span>
                                🔒 Mức độ: {previewPost.visibility === "private" ? "Riêng tư" : "Công khai"}
                            </span>
                            <span>
                                📊 Trạng thái:{" "}
                                {previewPost.status === "approved"
                                    ? "✅ Đã duyệt"
                                    : previewPost.status === "rejected"
                                        ? "❌ Từ chối"
                                        : "⏳ Chờ duyệt"}
                            </span>
                        </div>

                        {previewPost.summary && (
                            <div
                                style={{
                                    backgroundColor: "#f8fafc",
                                    padding: "12px 16px",
                                    borderRadius: "8px",
                                    borderLeft: "4px solid #3b82f6",
                                    marginBottom: "16px",
                                    fontStyle: "italic",
                                }}
                            >
                                {previewPost.summary}
                            </div>
                        )}

                        <div
                            style={{
                                fontSize: "0.95rem",
                                color: "#334155",
                                lineHeight: "1.6",
                                whiteSpace: "pre-wrap",
                            }}
                        >
                            {previewPost.content}
                        </div>

                        {previewPost.rejectionReason && (
                            <div
                                style={{
                                    backgroundColor: "#fee2e2",
                                    padding: "12px",
                                    borderRadius: "8px",
                                    marginTop: "16px",
                                    color: "#b91c1c",
                                    fontSize: "0.9rem",
                                }}
                            >
                                <strong>Lý do từ chối trước đó:</strong> {previewPost.rejectionReason}
                            </div>
                        )}

                        <div
                            style={{
                                marginTop: "24px",
                                paddingTop: "16px",
                                borderTop: "1px solid #e2e8f0",
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "12px",
                            }}
                        >
                            <button
                                onClick={() => setPreviewPost(null)}
                                style={{
                                    padding: "8px 16px",
                                    borderRadius: "6px",
                                    border: "1px solid #cbd5e1",
                                    backgroundColor: "#f8fafc",
                                    cursor: "pointer",
                                }}
                            >
                                Đóng
                            </button>
                            {previewPost.status !== "approved" && (
                                <button
                                    onClick={() => {
                                        setPreviewPost(null);
                                        handleOpenActionModal(previewPost, "approved");
                                    }}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "6px",
                                        border: "none",
                                        backgroundColor: "#16a34a",
                                        color: "#fff",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                    }}
                                >
                                    ✅ Duyệt Bài
                                </button>
                            )}
                            {previewPost.status !== "rejected" && (
                                <button
                                    onClick={() => {
                                        setPreviewPost(null);
                                        handleOpenActionModal(previewPost, "rejected");
                                    }}
                                    style={{
                                        padding: "8px 16px",
                                        borderRadius: "6px",
                                        border: "none",
                                        backgroundColor: "#dc2626",
                                        color: "#fff",
                                        fontWeight: "600",
                                        cursor: "pointer",
                                    }}
                                >
                                    ❌ Từ Chối
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManagePosts;
