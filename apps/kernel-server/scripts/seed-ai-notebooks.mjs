// Seeds the 8 "AI từ Zero" notebooks onto kernel-server (idempotent PUT; needs
// DEV_AUTH_ROLE bypass or an admin token). Companion of packages/db seed:ai.
// Run: node scripts/seed-ai-notebooks.mjs
const BASE = "http://localhost:3006"

let cellId = 0
const md = (source) => ({
  id: `cell-seed-${++cellId}`,
  cell_type: "markdown",
  source,
  metadata: {},
})
const code = (source) => ({
  id: `cell-seed-${++cellId}`,
  cell_type: "code",
  source,
  metadata: {},
  execution_count: null,
  outputs: [],
})

const notebooks = {
  "python-co-ban": {
    title: "Python cơ bản",
    cells: [
      md("# Python cơ bản\n\nBài đầu tiên của lộ trình **AI từ Zero**. Bấm nút ▶ bên trái mỗi ô code (hoặc `Shift+Enter`) để chạy.\n\nMục tiêu: biến, kiểu dữ liệu, điều khiển luồng và hàm."),
      md("## 1. Biến và kiểu dữ liệu\n\nPython không cần khai báo kiểu — gán là xong."),
      code('ten = "Lan"          # chuỗi (str)\ntuoi = 21             # số nguyên (int)\ndiem = 8.5            # số thực (float)\ndang_hoc = True       # boolean\n\nprint(ten, tuoi, diem, dang_hoc)\nprint(type(ten), type(tuoi))'),
      md("## 2. Danh sách và dictionary\n\nHai cấu trúc dữ liệu bạn sẽ dùng mỗi ngày."),
      code('diem_thi = [7.5, 8.0, 9.25, 6.75]\nprint("Cao nhất:", max(diem_thi))\nprint("Trung bình:", sum(diem_thi) / len(diem_thi))\n\nsinh_vien = {"ten": "Lan", "nganh": "AI", "nam": 2}\nprint(sinh_vien["nganh"])'),
      md("## 3. Điều khiển luồng: `if` và `for`"),
      code('for d in diem_thi:\n    if d >= 8:\n        xep_loai = "Giỏi"\n    elif d >= 6.5:\n        xep_loai = "Khá"\n    else:\n        xep_loai = "Trung bình"\n    print(f"{d} -> {xep_loai}")'),
      md("## 4. Hàm\n\nGói logic vào hàm để tái sử dụng."),
      code('def xep_loai(diem):\n    """Xếp loại theo thang điểm 10."""\n    if diem >= 8:\n        return "Giỏi"\n    if diem >= 6.5:\n        return "Khá"\n    return "Trung bình"\n\nprint([xep_loai(d) for d in diem_thi])'),
      md("## Bài tập\n\nViết hàm `binh_phuong(xs)` nhận một danh sách số và trả về danh sách các bình phương. Thử với `[1, 2, 3, 4]` — kỳ vọng `[1, 4, 9, 16]`."),
      code("# Viết code của bạn ở đây\ndef binh_phuong(xs):\n    ...\n\n# binh_phuong([1, 2, 3, 4])"),
    ],
  },
  "numpy-co-ban": {
    title: "NumPy cơ bản",
    cells: [
      md("# NumPy cơ bản\n\nNumPy là nền móng của mọi thư viện AI: mảng nhiều chiều + phép toán vector hóa nhanh gấp trăm lần vòng lặp Python."),
      code('import numpy as np\n\na = np.array([1, 2, 3, 4, 5])\nprint(a, a.dtype, a.shape)'),
      md("## Vectorization\n\nPhép toán áp dụng lên **cả mảng** một lúc — không cần vòng lặp."),
      code("print(a * 2)        # nhân từng phần tử\nprint(a ** 2)       # bình phương\nprint(a + np.array([10, 20, 30, 40, 50]))"),
      md("## Mảng 2 chiều (ma trận)"),
      code('m = np.arange(12).reshape(3, 4)\nprint(m)\nprint("hàng 0:", m[0])\nprint("cột 1:", m[:, 1])\nprint("tổng theo cột:", m.sum(axis=0))'),
      md("## Broadcasting\n\nNumPy tự \"kéo giãn\" mảng nhỏ cho khớp mảng lớn — quy tắc quan trọng nhất khi làm việc với dữ liệu."),
      code("diem = np.array([[7, 8], [5, 9], [6, 6]])   # 3 sinh viên x 2 môn\nhe_so = np.array([0.4, 0.6])                 # trọng số 2 môn\ndiem_tb = (diem * he_so).sum(axis=1)\nprint(diem_tb)"),
      md("## Bài tập\n\nTạo mảng 100 số ngẫu nhiên chuẩn (`np.random.randn(100)`) rồi in ra mean và std của nó."),
      code("# Viết code của bạn ở đây\n"),
    ],
  },
  "pandas-co-ban": {
    title: "Pandas cơ bản",
    cells: [
      md("# Pandas cơ bản\n\nPandas = bảng tính lập trình được. `DataFrame` là cấu trúc trung tâm của mọi dự án dữ liệu."),
      code('import pandas as pd\n\ndf = pd.DataFrame({\n    "ten": ["Lan", "Minh", "Huy", "Trang", "Quan"],\n    "nganh": ["AI", "AI", "Web", "Data", "Web"],\n    "diem": [8.5, 7.0, 6.5, 9.0, 7.5],\n})\ndf'),
      md("## Lọc dữ liệu\n\nĐiều kiện boolean trả về đúng các dòng cần tìm."),
      code('print(df[df["diem"] >= 7.5])\nprint(df[(df["nganh"] == "AI") & (df["diem"] > 7)])'),
      md("## Cột mới và thống kê mô tả"),
      code('df["xep_loai"] = df["diem"].apply(lambda d: "Giỏi" if d >= 8 else "Khá")\ndf.describe()'),
      md("## `groupby` — chia nhóm rồi tổng hợp"),
      code('df.groupby("nganh")["diem"].agg(["mean", "max", "count"])'),
      md("## Bài tập\n\nThêm sinh viên thứ 6 vào DataFrame (dùng `pd.concat`) rồi tính lại điểm trung bình theo ngành."),
      code("# Viết code của bạn ở đây\n"),
    ],
  },
  "truc-quan-hoa-matplotlib": {
    title: "Trực quan hóa với Matplotlib",
    cells: [
      md("# Trực quan hóa với Matplotlib\n\nNhìn thấy dữ liệu trước khi mô hình hóa. Biểu đồ hiện ngay dưới ô code."),
      code('import numpy as np\nimport matplotlib.pyplot as plt\n\nx = np.linspace(0, 2 * np.pi, 100)\nplt.plot(x, np.sin(x), label="sin(x)")\nplt.plot(x, np.cos(x), label="cos(x)")\nplt.legend()\nplt.title("Đường sin và cos")\nplt.show()'),
      md("## Scatter — quan hệ giữa 2 biến"),
      code('rng = np.random.default_rng(42)\ngio_hoc = rng.uniform(0, 10, 50)\ndiem = 5 + 0.45 * gio_hoc + rng.normal(0, 0.5, 50)\n\nplt.scatter(gio_hoc, diem, alpha=0.7)\nplt.xlabel("Giờ tự học mỗi tuần")\nplt.ylabel("Điểm")\nplt.title("Học nhiều hơn, điểm cao hơn?")\nplt.show()'),
      md("## Histogram — phân phối của 1 biến"),
      code('data = rng.normal(loc=170, scale=6, size=1000)   # chiều cao (cm)\nplt.hist(data, bins=30, edgecolor="black")\nplt.xlabel("Chiều cao (cm)")\nplt.title("Phân phối chuẩn quanh 170cm")\nplt.show()'),
      md("## Bài tập\n\nVẽ histogram của `np.random.exponential(size=1000)` với 40 bins. Phân phối này khác phân phối chuẩn thế nào?"),
      code("# Viết code của bạn ở đây\n"),
    ],
  },
  "dai-so-tuyen-tinh": {
    title: "Đại số tuyến tính",
    cells: [
      md("# Đại số tuyến tính với NumPy\n\nVector và ma trận là ngôn ngữ của machine learning: dữ liệu là ma trận, trọng số là vector, dự đoán là phép nhân ma trận."),
      md("## Vector: tích vô hướng (dot product)\n\n$\\vec{a} \\cdot \\vec{b} = \\sum a_i b_i$ — phép đo \"độ cùng hướng\", xuất hiện trong mọi neuron."),
      code('import numpy as np\n\na = np.array([1.0, 2.0, 3.0])\nb = np.array([4.0, 5.0, 6.0])\nprint("dot:", a @ b)                       # 1*4 + 2*5 + 3*6 = 32\nprint("độ dài của a:", np.linalg.norm(a))'),
      md("## Ma trận nhân vector = biến đổi tuyến tính\n\nĐây chính xác là những gì 1 lớp của mạng nơ-ron làm: `y = W @ x + b`."),
      code('W = np.array([[0.5, -1.0, 2.0],\n              [1.5,  0.0, 0.5]])   # 2x3: nén 3 chiều xuống 2 chiều\nx = np.array([1.0, 2.0, 3.0])\nprint("W @ x =", W @ x)'),
      md("## Nhân ma trận với ma trận\n\nXử lý **cả batch** dữ liệu trong một phép tính."),
      code("X = np.array([[1., 2., 3.],\n              [4., 5., 6.],\n              [7., 8., 9.],\n              [1., 0., 1.]])       # 4 mẫu x 3 đặc trưng\nprint((X @ W.T).shape)              # -> (4, 2): 4 mẫu, 2 đầu ra\nprint(X @ W.T)"),
      md("## Bài tập\n\nCho `v = np.array([3, 4])`. Tính vector đơn vị cùng hướng với `v` (chia cho độ dài). Kiểm tra norm của kết quả bằng 1."),
      code("# Viết code của bạn ở đây\n"),
    ],
  },
  "hoi-quy-tuyen-tinh": {
    title: "Hồi quy tuyến tính từ zero",
    cells: [
      md("# Hồi quy tuyến tính từ zero\n\nBài ML đầu tiên: dự đoán `y` từ `x` bằng đường thẳng `y = w*x + b`, tự cài **gradient descent** — không dùng thư viện ML nào."),
      code('import numpy as np\nimport matplotlib.pyplot as plt\n\nrng = np.random.default_rng(0)\nx = rng.uniform(0, 10, 80)\ny_that = 2.5 * x + 7          # quy luật thật (mô hình phải tự tìm ra)\ny = y_that + rng.normal(0, 2, 80)\n\nplt.scatter(x, y, alpha=0.6)\nplt.title("Dữ liệu: y ≈ 2.5x + 7 + nhiễu")\nplt.show()'),
      md("## Gradient descent\n\nLặp: dự đoán → đo lỗi (MSE) → chỉnh `w, b` ngược hướng gradient."),
      code('w, b = 0.0, 0.0\nlr = 0.01\n\nfor buoc in range(1000):\n    y_du_doan = w * x + b\n    loi = y_du_doan - y\n    # gradient của MSE theo w và b\n    dw = 2 * (loi * x).mean()\n    db = 2 * loi.mean()\n    w -= lr * dw\n    b -= lr * db\n    if buoc % 200 == 0:\n        print(f"bước {buoc:3d}: MSE = {(loi ** 2).mean():.3f}, w = {w:.2f}, b = {b:.2f}")\n\nprint(f"\\nKết quả: y = {w:.2f}x + {b:.2f}  (quy luật thật: y = 2.5x + 7)")'),
      md("## Nhìn mô hình đã học"),
      code('plt.scatter(x, y, alpha=0.5, label="dữ liệu")\nxs = np.linspace(0, 10, 100)\nplt.plot(xs, w * xs + b, color="red", linewidth=2, label=f"mô hình: {w:.2f}x + {b:.2f}")\nplt.legend()\nplt.show()'),
      md("## Bài tập\n\nGiảm `lr` xuống `0.001` rồi chạy lại — mô hình hội tụ nhanh hơn hay chậm hơn? Tăng số bước lên 2000 thì sao?"),
      code("# Thí nghiệm của bạn ở đây\n"),
    ],
  },
  "phan-loai-sklearn": {
    title: "Phân loại với scikit-learn",
    cells: [
      md("# Phân loại với scikit-learn\n\nQuy trình ML chuẩn trong 4 bước: **chia dữ liệu → train → dự đoán → đánh giá**, trên bộ hoa Iris kinh điển."),
      code('from sklearn.datasets import load_iris\nfrom sklearn.model_selection import train_test_split\n\niris = load_iris()\nX_train, X_test, y_train, y_test = train_test_split(\n    iris.data, iris.target, test_size=0.3, random_state=42\n)\nprint("Train:", X_train.shape, "- Test:", X_test.shape)\nprint("Các lớp:", list(iris.target_names))'),
      md("## Train và đánh giá"),
      code('from sklearn.linear_model import LogisticRegression\nfrom sklearn.metrics import accuracy_score, confusion_matrix\n\nmodel = LogisticRegression(max_iter=1000)\nmodel.fit(X_train, y_train)\n\ny_pred = model.predict(X_test)\nprint("Accuracy:", accuracy_score(y_test, y_pred))\nprint("Ma trận nhầm lẫn:\\n", confusion_matrix(y_test, y_pred))'),
      md("## Dự đoán một bông hoa mới"),
      code('hoa_moi = [[5.1, 3.5, 1.4, 0.2]]   # sepal dài/rộng, petal dài/rộng (cm)\ndu_doan = model.predict(hoa_moi)[0]\nxac_suat = model.predict_proba(hoa_moi)[0]\nprint("Dự đoán:", iris.target_names[du_doan])\nfor ten, p in zip(iris.target_names, xac_suat):\n    print(f"  {ten}: {p:.1%}")'),
      md("## Bài tập\n\nThay `LogisticRegression` bằng `KNeighborsClassifier` (từ `sklearn.neighbors`) — accuracy thay đổi thế nào?"),
      code("# Viết code của bạn ở đây\n"),
    ],
  },
  "mang-no-ron-tu-zero": {
    title: "Mạng nơ-ron từ zero",
    cells: [
      md("# Mạng nơ-ron từ zero\n\nĐích của lộ trình: tự cài mạng nơ-ron 2 lớp bằng NumPy học hàm **XOR** — bài toán mà một đường thẳng không thể giải."),
      code('import numpy as np\n\nX = np.array([[0, 0], [0, 1], [1, 0], [1, 1]], dtype=float)\ny = np.array([[0], [1], [1], [0]], dtype=float)   # XOR\nprint("XOR: đầu vào khác nhau -> 1, giống nhau -> 0")'),
      md("## Kiến trúc: 2 → 4 → 1\n\nLớp ẩn 4 neuron với sigmoid cho mô hình khả năng \"bẻ cong\" ranh giới quyết định."),
      code('def sigmoid(z):\n    return 1 / (1 + np.exp(-z))\n\nrng = np.random.default_rng(1)\nW1 = rng.normal(0, 1, (2, 4))\nb1 = np.zeros(4)\nW2 = rng.normal(0, 1, (4, 1))\nb2 = np.zeros(1)'),
      md("## Train với backpropagation\n\nLan truyền xuôi tính dự đoán; lan truyền ngược tính gradient qua quy tắc chuỗi."),
      code('lr = 1.0\nfor buoc in range(3000):\n    # lan truyền xuôi\n    h = sigmoid(X @ W1 + b1)\n    y_hat = sigmoid(h @ W2 + b2)\n\n    # lan truyền ngược (đạo hàm của binary cross-entropy + sigmoid)\n    d_out = y_hat - y\n    dW2 = h.T @ d_out / len(X)\n    db2 = d_out.mean(axis=0)\n    d_hidden = (d_out @ W2.T) * h * (1 - h)\n    dW1 = X.T @ d_hidden / len(X)\n    db1 = d_hidden.mean(axis=0)\n\n    W1 -= lr * dW1; b1 -= lr * db1\n    W2 -= lr * dW2; b2 -= lr * db2\n\n    if buoc % 600 == 0:\n        loss = -(y * np.log(y_hat) + (1 - y) * np.log(1 - y_hat)).mean()\n        print(f"bước {buoc:4d}: loss = {loss:.4f}")'),
      md("## Kiểm tra kết quả"),
      code('y_hat = sigmoid(sigmoid(X @ W1 + b1) @ W2 + b2)\nfor dau_vao, du_doan, dich in zip(X, y_hat, y):\n    print(f"{dau_vao} -> {du_doan[0]:.3f} (đích: {int(dich[0])})")'),
      md("## Bài tập\n\nGiảm lớp ẩn xuống **1 neuron** (`W1` shape `(2,1)`, `W2` shape `(1,1)`) rồi train lại. Mạng còn học được XOR không? Vì sao?\n\n---\n\n🎉 Hoàn thành lộ trình **AI từ Zero**! Bước tiếp theo: PyTorch, transformer và LLM."),
      code("# Thí nghiệm của bạn ở đây\n"),
    ],
  },
}

for (const [slug, nb] of Object.entries(notebooks)) {
  const body = {
    title: nb.title,
    published: true,
    runtimeProfile: "data-science",
    notebook: {
      nbformat: 4,
      nbformat_minor: 5,
      metadata: {
        kernelspec: { name: "python3", display_name: "Python 3", language: "python" },
        language_info: { name: "python" },
        title: nb.title,
      },
      cells: nb.cells,
    },
  }
  const res = await fetch(`${BASE}/api/notebooks/${slug}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  console.log(slug, res.status)
  if (!res.ok) console.error(await res.text())
}
