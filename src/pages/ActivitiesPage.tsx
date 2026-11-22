import { Link } from "react-router-dom";

export function ActivitiesPage() {
  return (
    <main className="placeholder-page">
      <div className="placeholder-card">
        <div className="eyebrow">活动模块 · 示意入口</div>
        <h1>待审核报名在活动模块处理</h1>
        <p>
          本单只交付课期报名名单与出勤补录页。名单页的“审核”已跳转到活动模块路由，
          真实审核流程由活动模块实现，不在本页重复开发。
        </p>
        <Link className="text-link" to="/academy/sessions/sess-2078/roster">
          返回课期名单
        </Link>
      </div>
    </main>
  );
}
