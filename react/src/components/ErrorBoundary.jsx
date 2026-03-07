import React from "react";

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);

        // Chunk load error detection (happens when Vercel deploys a new version and old chunks are deleted)
        const isChunkLoadFailed = /Loading chunk [\d]+ failed/i.test(error.message) || /Failed to fetch dynamically imported module/i.test(error.message);

        if (isChunkLoadFailed) {
            // Clear out old service worker caches and hard reload the page
            if ('caches' in window) {
                caches.keys().then((names) => {
                    for (let name of names) {
                        caches.delete(name);
                    }
                }).then(() => {
                    window.location.reload(true);
                });
            } else {
                window.location.reload(true);
            }
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: "40px", textAlign: "center", fontFamily: "sans-serif" }}>
                    <h2>새로운 버전이 업데이트 되었습니다! 🚀</h2>
                    <p>원활한 사용을 위해 화면을 새로고침합니다...</p>
                    <button
                        onClick={() => window.location.reload(true)}
                        style={{ padding: "10px 20px", marginTop: "20px", cursor: "pointer", background: "#3b82f6", color: "white", border: "none", borderRadius: "8px" }}
                    >
                        수동 새로고침
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
