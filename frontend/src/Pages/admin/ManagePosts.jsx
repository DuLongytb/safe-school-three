import React, { useState, useEffect } from "react";
import { getPosts, approvePost, deletePost } from "../../api/admin";
import Modal from "../../components/Common/Modal";
import Toast from "../../components/Common/Toast";
import { db } from "../../firebase/config";
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { deleteArticleCascadeService } from "../../services/articleService";
import { analyzeContent, MODERATION_CATEGORIES } from "../../services/moderationService";

const ManagePosts = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [statusFilter, setStatusFilter] = useState("all");
    const [moderationFilter, setModerationFilter] = useState("all");
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
                const enriched = res.data.map(p => ({
                    ...p,
                    moderation: p.moderation || analyzeContent(p.title, p.summary, p.content),
                }));
                setPosts(enriched);
            } else {
                // Direct Firestore fallback from 'articles' collection
                const articlesRef = collection(db, "articles");
                let q = query(articlesRef, where("isDeleted", "!=", true));
                if (statusFilter !== "all") {
                    q = query(articlesRef, where("isDeleted", "!=", true), where("status", "==", statusFilter));
                }
                const snap = await getDocs(q);
                let fetched = snap.docs.map(docSnap => {
                    const data = docSnap.data();
                    const moderation = data.moderation || analyzeContent(data.title, data.summary, data.content);
                    return {
                        id: docSnap.id,
                        ...data,
                        moderation,
                        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
                    };
                });
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

    // Xác nhận Duyệt hoặc Từ chối bài viết — Cập nhật cả trạng thái duyệt và moderation
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
                moderation: {
                    status: "reviewed",
                    flags: selectedPost.moderation?.flags || [],
                    flagDetails: selectedPost.moderation?.flagDetails || [],
                    educationalContextDetected: selectedPost.moderation?.educationalContextDetected || false,
                    reviewedBy: "admin",
                    reviewedAt: nowIso,
                    moderationDecision: actionType,
                    moderationNote: reasonInput || "",
                },
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

    // Toggle isFeatured trên Firestore — chỉ Admin
    const handleToggleFeatured = async (post) => {
        try {
            const docRef = doc(db, "articles", post.id);
            const nowFeatured = !Boolean(post.isFeatured);
            const payload = nowFeatured
                ? { isFeatured: true, featuredAt: serverTimestamp() }
                : { isFeatured: false };
            await updateDoc(docRef, payload);
            setToast({
                message: nowFeatured
                    ? `⭐ Đã đánh dấu chất lượng: "${post.title || "Bài viết"}"`
                    : `✖️ Đã bỏ chất lượng: "${post.title || "Bài viết"}"`,
                type: nowFeatured ? "success" : "info",
            });
            fetchPostsList();
        } catch (err) {
            setToast({ message: "Lỗi khi cập nhật chất lượng: " + err.message, type: "error" });
        }
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

    // Lọc bài viết theo tìm kiếm, trạng thái và kiểm duyệt
    const filteredPosts = posts.filter((p) => {
        const titleMatch = (p.title || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        const authorMatch = (p.authorName || p.authorId || "")
            .toLowerCase()
            .includes(searchTerm.toLowerCase());
        const matchesSearch = titleMatch || authorMatch;

        if (!matchesSearch) return false;

        if (moderationFilter !== "all") {
            const modStatus = p.moderation?.status || "normal";
            if (moderationFilter !== modStatus) return false;
        }

        return true;
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

            {/* Control Bar: Search, Status & Moderation Filter */}
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
                <div style={{ position: "relative", flex: "1", minWidth: "240px" }}>
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

                {/* Filter Dropdowns Container */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                    {/* Status Filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label
                            style={{ fontSize: "0.85rem", fontWeight: "600", color: "#475569" }}
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
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.85rem",
                                backgroundColor: "#ffffff",
                                cursor: "pointer",
                                outline: "none",
                            }}
                        >
                            <option value="all">Tất cả trạng thái</option>
                            <option value="pending">Chờ duyệt (Pending)</option>
                            <option value="approved">Đã duyệt (Approved)</option>
                            <option value="rejected">Đã từ chối (Rejected)</option>
                        </select>
                    </div>

                    {/* Moderation Filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <label
                            style={{ fontSize: "0.85rem", fontWeight: "600", color: "#475569" }}
                        >
                            Kiểm Duyệt:
                        </label>
                        <select
                            value={moderationFilter}
                            onChange={(e) => {
                                setModerationFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            style={{
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                fontSize: "0.85rem",
                                backgroundColor: "#ffffff",
                                cursor: "pointer",
                                outline: "none",
                            }}
                        >
                            <option value="all">Tất cả kiểm duyệt</option>
                            <option value="review_required">🟡 Cần xem xét</option>
                            <option value="normal">🟢 Bình thường</option>
                            <option value="reviewed">🔵 Đã kiểm duyệt</option>
                        </select>
                    </div>
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
                        overflowX: "auto",
                        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
                    }}
                >
                    <table
                        style={{
                            width: "100%",
                            minWidth: "1080px",
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
                                <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Tiêu Đề Bài Viết</th>
                                <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Tác Giả</th>
                                <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Trạng Thái</th>
                                <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Kiểm Duyệt</th>
                                <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Chất Lượng</th>
                                <th style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>Ngày Tạo</th>
                                <th style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                                    Thao Tác
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedPosts.length === 0 ? (
                                <tr>
                                    <td
                                        colSpan={7}
                                        style={{
                                            padding: "32px",
                                            textAlign: "center",
                                            color: "#94a3b8",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        Không có bài viết nào phù hợp.
                                    </td>
                                </tr>
                            ) : (
                                paginatedPosts.map((p) => {
                                    const mod = p.moderation || { status: 'normal', flags: [] };
                                    const isReviewRequired = mod.status === 'review_required';
                                    const isReviewed = mod.status === 'reviewed';
                                    const isPending = (p.status || "pending") === "pending";
                                    const isApproved = p.status === "approved";
                                    const isRejected = p.status === "rejected";

                                    return (
                                        <tr
                                            key={p.id}
                                            style={{
                                                borderBottom: "1px solid #f1f5f9",
                                                backgroundColor: isReviewRequired ? "#fffdf5" : "transparent",
                                                transition: "background-color 0.15s",
                                            }}
                                        >
                                            {/* Title & Warning Tag */}
                                            <td style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap", maxWidth: "280px" }}>
                                                <div
                                                    style={{
                                                        fontWeight: "600",
                                                        color: "#0f172a",
                                                        marginBottom: "4px",
                                                        whiteSpace: "nowrap",
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                    }}
                                                    title={p.title || "Bài viết không tiêu đề"}
                                                >
                                                    {p.title || "Bài viết không tiêu đề"}
                                                </div>

                                                {/* Moderation Warning pill list */}
                                                {isReviewRequired && (
                                                    <div style={{ display: "flex", alignItems: "center", flexWrap: "nowrap", gap: "4px", marginTop: "4px" }}>
                                                        <span
                                                            style={{
                                                                display: "inline-flex",
                                                                alignItems: "center",
                                                                gap: "3px",
                                                                backgroundColor: "#fef3c7",
                                                                color: "#b45309",
                                                                border: "1px solid #fde68a",
                                                                padding: "2px 6px",
                                                                borderRadius: "4px",
                                                                fontSize: "0.72rem",
                                                                fontWeight: "600",
                                                                whiteSpace: "nowrap",
                                                            }}
                                                        >
                                                            ⚠️ Cần xem xét
                                                        </span>
                                                        {mod.flags?.map((flagId) => {
                                                            const cat = Object.values(MODERATION_CATEGORIES).find(c => c.id === flagId);
                                                            return (
                                                                <span
                                                                    key={flagId}
                                                                    style={{
                                                                        backgroundColor: cat?.bgColor || "#f1f5f9",
                                                                        color: cat?.color || "#475569",
                                                                        padding: "2px 6px",
                                                                        borderRadius: "4px",
                                                                        fontSize: "0.7rem",
                                                                        fontWeight: "600",
                                                                        whiteSpace: "nowrap",
                                                                    }}
                                                                >
                                                                    {cat?.label || flagId}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Author */}
                                            <td style={{ padding: "14px 18px", verticalAlign: "middle", color: "#334155", whiteSpace: "nowrap" }}>
                                                {p.authorName || p.authorId || "Học sinh ẩn danh"}
                                            </td>

                                            {/* Status */}
                                            <td style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                                                {isApproved && (
                                                    <span
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            backgroundColor: "#dcfce7",
                                                            color: "#15803d",
                                                            padding: "4px 12px",
                                                            borderRadius: "12px",
                                                            fontSize: "0.8rem",
                                                            fontWeight: "600",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        ✅ Đã duyệt
                                                    </span>
                                                )}
                                                {isRejected && (
                                                    <span
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            backgroundColor: "#fee2e2",
                                                            color: "#b91c1c",
                                                            padding: "4px 12px",
                                                            borderRadius: "12px",
                                                            fontSize: "0.8rem",
                                                            fontWeight: "600",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        ❌ Đã từ chối
                                                    </span>
                                                )}
                                                {isPending && (
                                                    <span
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            backgroundColor: "#fef3c7",
                                                            color: "#b45309",
                                                            padding: "4px 12px",
                                                            borderRadius: "12px",
                                                            fontSize: "0.8rem",
                                                            fontWeight: "600",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        ⏳ Chờ duyệt
                                                    </span>
                                                )}
                                            </td>

                                            {/* Moderation Status Column */}
                                            <td style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                                                {isReviewRequired ? (
                                                    <span
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            backgroundColor: "#fef3c7",
                                                            color: "#b45309",
                                                            border: "1px solid #fde68a",
                                                            padding: "3px 8px",
                                                            borderRadius: "12px",
                                                            fontSize: "0.78rem",
                                                            fontWeight: "600",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        🟡 Cần xem xét
                                                    </span>
                                                ) : isReviewed ? (
                                                    <span
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            backgroundColor: "#eff6ff",
                                                            color: "#1d4ed8",
                                                            padding: "3px 8px",
                                                            borderRadius: "12px",
                                                            fontSize: "0.78rem",
                                                            fontWeight: "600",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        🔵 Đã kiểm duyệt
                                                    </span>
                                                ) : (
                                                    <span
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            backgroundColor: "#f0fdf4",
                                                            color: "#15803d",
                                                            padding: "3px 8px",
                                                            borderRadius: "12px",
                                                            fontSize: "0.78rem",
                                                            fontWeight: "600",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        🟢 Bình thường
                                                    </span>
                                                )}
                                            </td>

                                            {/* Quality status badge */}
                                            <td style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                                                {Boolean(p.isFeatured) ? (
                                                    <span style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        gap: "4px",
                                                        backgroundColor: "#fef9c3",
                                                        color: "#a16207",
                                                        padding: "4px 10px",
                                                        borderRadius: "12px",
                                                        fontSize: "0.8rem",
                                                        fontWeight: "600",
                                                        whiteSpace: "nowrap",
                                                    }}>
                                                        ⭐ Chất lượng
                                                    </span>
                                                ) : (
                                                    <span style={{ color: "#94a3b8", fontSize: "0.8rem", whiteSpace: "nowrap" }}>—</span>
                                                )}
                                            </td>

                                            {/* Date */}
                                            <td
                                                style={{
                                                    padding: "14px 18px",
                                                    verticalAlign: "middle",
                                                    color: "#64748b",
                                                    fontSize: "0.85rem",
                                                    whiteSpace: "nowrap",
                                                }}
                                            >
                                                {formatDate(p.createdAt)}
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: "12px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                                                <div
                                                    style={{
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "flex-end",
                                                        gap: "6px",
                                                        flexWrap: "nowrap",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {/* 1. Nhóm Xem & Quản lý */}
                                                    <button
                                                        onClick={() => setPreviewPost(p)}
                                                        title="Xem chi tiết bài viết"
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            padding: "5px 10px",
                                                            borderRadius: "6px",
                                                            border: "1px solid #cbd5e1",
                                                            backgroundColor: "#ffffff",
                                                            color: "#334155",
                                                            fontWeight: "600",
                                                            fontSize: "0.8rem",
                                                            cursor: "pointer",
                                                            whiteSpace: "nowrap",
                                                            transition: "all 0.15s ease",
                                                        }}
                                                    >
                                                        <span>👁️</span> Xem
                                                    </button>

                                                    {/* Divider ngăn cách nhóm */}
                                                    <span style={{ width: "1px", height: "16px", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

                                                    {/* 2. Nhóm Kiểm duyệt & Trạng thái */}
                                                    <button
                                                        onClick={() => handleOpenActionModal(p, "approved")}
                                                        disabled={isApproved}
                                                        title={isApproved ? "Bài viết đã được duyệt" : "Duyệt xuất bản bài viết"}
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            padding: "5px 10px",
                                                            borderRadius: "6px",
                                                            border: isApproved ? "1px solid #e2e8f0" : "1px solid #86efac",
                                                            backgroundColor: isApproved ? "#f8fafc" : "#f0fdf4",
                                                            color: isApproved ? "#94a3b8" : "#16a34a",
                                                            fontWeight: "600",
                                                            fontSize: "0.8rem",
                                                            cursor: isApproved ? "default" : "pointer",
                                                            whiteSpace: "nowrap",
                                                            transition: "all 0.15s ease",
                                                        }}
                                                    >
                                                        <span>✓</span> Duyệt
                                                    </button>

                                                    <button
                                                        onClick={() => handleOpenActionModal(p, "rejected")}
                                                        disabled={isRejected}
                                                        title={isRejected ? "Bài viết đã bị từ chối" : "Từ chối bài viết"}
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            padding: "5px 10px",
                                                            borderRadius: "6px",
                                                            border: isRejected ? "1px solid #e2e8f0" : "1px solid #fecaca",
                                                            backgroundColor: isRejected ? "#f8fafc" : "#fef2f2",
                                                            color: isRejected ? "#94a3b8" : "#dc2626",
                                                            fontWeight: "600",
                                                            fontSize: "0.8rem",
                                                            cursor: isRejected ? "default" : "pointer",
                                                            whiteSpace: "nowrap",
                                                            transition: "all 0.15s ease",
                                                        }}
                                                    >
                                                        <span>✕</span> Từ chối
                                                    </button>

                                                    <button
                                                        onClick={() => handleToggleFeatured(p)}
                                                        title={Boolean(p.isFeatured) ? "Bỏ đánh dấu chất lượng" : "Đánh dấu bài viết chất lượng"}
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            padding: "5px 10px",
                                                            borderRadius: "6px",
                                                            border: Boolean(p.isFeatured) ? "1px solid #fde047" : "1px solid #cbd5e1",
                                                            backgroundColor: Boolean(p.isFeatured) ? "#fefce8" : "#ffffff",
                                                            color: Boolean(p.isFeatured) ? "#a16207" : "#475569",
                                                            fontWeight: "600",
                                                            fontSize: "0.8rem",
                                                            cursor: "pointer",
                                                            whiteSpace: "nowrap",
                                                            transition: "all 0.15s ease",
                                                        }}
                                                    >
                                                        <span>{Boolean(p.isFeatured) ? "⭐" : "☆"}</span> Chất lượng
                                                    </button>

                                                    {/* Divider trước nút nguy hiểm */}
                                                    <span style={{ width: "1px", height: "16px", backgroundColor: "#e2e8f0", flexShrink: 0 }} />

                                                    {/* 3. Nhóm Nguy hiểm: Xóa */}
                                                    <button
                                                        onClick={() => handleOpenActionModal(p, "delete")}
                                                        title="Xóa bài viết khỏi hệ thống"
                                                        style={{
                                                            display: "inline-flex",
                                                            alignItems: "center",
                                                            gap: "4px",
                                                            padding: "5px 10px",
                                                            borderRadius: "6px",
                                                            border: "1px solid #fecdd3",
                                                            backgroundColor: "#fff1f2",
                                                            color: "#e11d48",
                                                            fontWeight: "600",
                                                            fontSize: "0.8rem",
                                                            cursor: "pointer",
                                                            whiteSpace: "nowrap",
                                                            transition: "all 0.15s ease",
                                                        }}
                                                    >
                                                        <span>🗑️</span> Xóa
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

            {/* Preview Post Modal — Tích Hợp Bảng Hỗ Trợ Kiểm Duyệt Ngôn Từ */}
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
                            borderRadius: "14px",
                            maxWidth: "760px",
                            width: "100%",
                            maxHeight: "88vh",
                            overflowY: "auto",
                            padding: "24px 28px",
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
                            <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                                <span>📰</span> Xem & Kiểm Duyệt Nội Dung Bài Viết
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

                        <h2 style={{ margin: "0 0 8px 0", color: "#0f172a", fontSize: "1.3rem", lineHeight: "1.4" }}>
                            {previewPost.title}
                        </h2>
                        <div
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "12px",
                                fontSize: "0.85rem",
                                color: "#64748b",
                                marginBottom: "16px",
                            }}
                        >
                            <span>✍️ {previewPost.authorName || previewPost.authorId || "Tác giả"}</span>
                            <span>🏷️ {previewPost.category || "Chưa phân loại"}</span>
                            <span>
                                🔒 {previewPost.visibility === "private" ? "Riêng tư" : "Công khai"}
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

                        {/* Hộp Hỗ Trợ Kiểm Duyệt (Moderation Assistant Panel) */}
                        {(() => {
                            const mod = previewPost.moderation || { status: 'normal', flags: [] };
                            const isReviewReq = mod.status === 'review_required';
                            const isRev = mod.status === 'reviewed';

                            if (isReviewReq) {
                                return (
                                    <div
                                        style={{
                                            backgroundColor: "#fffdf0",
                                            border: "1px solid #fde68a",
                                            borderRadius: "10px",
                                            padding: "16px",
                                            marginBottom: "20px",
                                            boxShadow: "0 1px 3px rgba(245, 158, 11, 0.05)",
                                        }}
                                    >
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                                            <h4 style={{ margin: 0, color: "#92400e", fontSize: "0.98rem", fontWeight: "700" }}>
                                                Hệ Thống Phát Hiện Tín Hiệu Nghi Vấn Cần Xem Xét
                                            </h4>
                                        </div>

                                        <div style={{ margin: "8px 0 12px 0", fontSize: "0.875rem", color: "#78350f" }}>
                                            <strong>Danh mục nghi vấn ghi nhận:</strong>
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px" }}>
                                                {mod.flags?.map((flagId) => {
                                                    const cat = Object.values(MODERATION_CATEGORIES).find(c => c.id === flagId);
                                                    const detail = mod.flagDetails?.find(d => d.category === flagId);
                                                    return (
                                                        <div
                                                            key={flagId}
                                                            style={{
                                                                backgroundColor: cat?.bgColor || "#fef3c7",
                                                                color: cat?.color || "#b45309",
                                                                border: `1px solid ${cat?.color}30`,
                                                                padding: "4px 10px",
                                                                borderRadius: "6px",
                                                                fontSize: "0.8rem",
                                                                fontWeight: "600",
                                                                display: "inline-flex",
                                                                flexDirection: "column",
                                                                gap: "2px",
                                                            }}
                                                        >
                                                            <span>🏷️ {cat?.label || flagId}</span>
                                                            {detail?.matchedSnippet && (
                                                                <span style={{ fontSize: "0.72rem", fontStyle: "italic", opacity: 0.85 }}>
                                                                    Khớp: "{detail.matchedSnippet}"
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {mod.educationalContextDetected && (
                                            <div
                                                style={{
                                                    backgroundColor: "#eff6ff",
                                                    color: "#1e40af",
                                                    border: "1px solid #bfdbfe",
                                                    borderRadius: "6px",
                                                    padding: "6px 12px",
                                                    fontSize: "0.8rem",
                                                    marginBottom: "10px",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "6px",
                                                }}
                                            >
                                                <span>💡</span>
                                                <span>
                                                    <strong>Ghi chú ngữ cảnh:</strong> Phát hiện bài viết có chứa từ khóa giáo dục / tuyên truyền phòng chống. Vui lòng cân nhắc toàn văn trước khi quyết định.
                                                </span>
                                            </div>
                                        )}

                                        <div
                                            style={{
                                                fontSize: "0.78rem",
                                                color: "#92400e",
                                                borderTop: "1px dashed #fde68a",
                                                paddingTop: "8px",
                                                fontStyle: "italic",
                                            }}
                                        >
                                            🛡️ <strong>Lưu ý quan trọng:</strong> Đây chỉ là kết quả phân tích hỗ trợ tự động. Admin là người đánh giá toàn bộ ngữ cảnh và đưa ra quyết định duyệt hoặc từ chối bài viết.
                                        </div>
                                    </div>
                                );
                            }

                            if (isRev) {
                                return (
                                    <div
                                        style={{
                                            backgroundColor: "#f0fdf4",
                                            border: "1px solid #bbf7d0",
                                            borderRadius: "8px",
                                            padding: "10px 14px",
                                            marginBottom: "16px",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            fontSize: "0.85rem",
                                            color: "#166534",
                                        }}
                                    >
                                        <span>🔵</span>
                                        <span>
                                            <strong>Bài viết đã qua kiểm duyệt:</strong> Quyết định của Admin:{" "}
                                            <strong>{mod.moderationDecision === "approved" ? "Duyệt công khai" : "Từ chối"}</strong>
                                            {mod.reviewedAt ? ` (${formatDate(mod.reviewedAt)})` : ""}
                                        </span>
                                    </div>
                                );
                            }

                            return (
                                <div
                                    style={{
                                        backgroundColor: "#f8fafc",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "8px",
                                        padding: "8px 12px",
                                        marginBottom: "16px",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        fontSize: "0.85rem",
                                        color: "#475569",
                                    }}
                                >
                                    <span>🟢</span>
                                    <span>
                                        <strong>Kiểm duyệt tự động:</strong> Không phát hiện tín hiệu ngôn từ nhạy cảm.
                                    </span>
                                </div>
                            );
                        })()}

                        {previewPost.summary && (
                            <div
                                style={{
                                    backgroundColor: "#f8fafc",
                                    padding: "12px 16px",
                                    borderRadius: "8px",
                                    borderLeft: "4px solid #3b82f6",
                                    marginBottom: "16px",
                                    fontStyle: "italic",
                                    color: "#475569",
                                    fontSize: "0.92rem",
                                }}
                            >
                                <strong>Tóm tắt:</strong> {previewPost.summary}
                            </div>
                        )}

                        <div
                            style={{
                                fontSize: "0.95rem",
                                color: "#334155",
                                lineHeight: "1.7",
                                border: "1px solid #f1f5f9",
                                borderRadius: "8px",
                                padding: "16px",
                                backgroundColor: "#ffffff",
                            }}
                            dangerouslySetInnerHTML={{ __html: previewPost.content }}
                        />

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
                                    color: "#475569",
                                    fontWeight: "600",
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
