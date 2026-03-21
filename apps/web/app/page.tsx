import Link from "next/link";

const setupSteps = [
  "1. 完成 Avatar 数据模型和 API",
  "2. 完成 Avatar 编辑器和 3D Viewer 骨架",
  "3. 打通服装上传和试穿任务",
  "4. 完成结果展示与历史记录"
];

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Stage 2</p>
        <h1>Choosing Clothes</h1>
        <p className="lead">
          Avatar 系统已经开始落地。当前阶段会先把 Avatar 数据、接口和编辑页面稳定下来，
          为后面的 3D 试穿链路打底。
        </p>
        <div className="actions-row">
          <Link className="action-link" href="/avatars">
            打开 Avatar Library
          </Link>
          <Link className="action-link secondary" href="/garments">
            打开 Garment Library
          </Link>
        </div>
      </section>

      <section className="grid">
        <article className="panel">
          <h2>当前目标</h2>
          <p>先打通 Avatar 的列表、创建入口和编辑页骨架，再逐步接入参数联动和 3D 模型。</p>
        </article>

        <article className="panel">
          <h2>近期步骤</h2>
          <ul>
            {setupSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
