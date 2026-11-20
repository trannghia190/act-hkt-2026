import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Chặn lỗi render của 1 màn hình để không làm trắng toàn bộ ứng dụng.
 * Hiển thị thông báo + nút tải lại thay vì màn hình trống.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Giữ log để tra cứu khi QA báo màn hình trắng.
    console.error('Screen crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-xl mx-auto mt-10 bg-surface border border-rose-200 rounded-xl p-6 text-sm">
          <div className="text-base font-bold text-rose-700">Màn hình đang gặp lỗi</div>
          <p className="text-xs text-ink-muted mt-2">
            Dữ liệu hoặc giao diện của màn này chưa tải được. Bạn thử tải lại; nếu vẫn lỗi, gửi thông tin dưới đây cho HR/IT.
          </p>
          <pre className="mt-3 bg-canvas border border-line rounded-lg p-3 text-[11px] overflow-auto text-rose-700">
            {this.state.error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              className="text-xs px-3 py-1.5 rounded bg-accent text-white"
              onClick={() => this.setState({ error: null })}
            >
              Thử lại
            </button>
            <button
              className="text-xs px-3 py-1.5 rounded border border-line"
              onClick={() => window.location.reload()}
            >
              Tải lại trang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
