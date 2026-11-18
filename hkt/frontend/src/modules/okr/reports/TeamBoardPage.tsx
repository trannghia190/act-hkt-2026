import React, { useState } from 'react';
import { Card } from '../../../components/common/Card';
import { Badge } from '../../../components/common/Badge';

export const TeamBoardPage: React.FC = () => {
  const [selectedTeam, setSelectedTeam] = useState('Sirius (Core Platform)');

  const members = [
    {
      name: 'Phạm Minh Tuấn (Lead)',
      code: 'ACT0045',
      okrCount: 3,
      avgProgress: 91.2,
      topGoal: 'Đảm bảo kiến trúc Microservice và hệ thống bảo mật Keycloak chuẩn',
      status: 'ON_TRACK'
    },
    {
      name: 'Nguyễn Văn Minh',
      code: 'ACT0142',
      okrCount: 2,
      avgProgress: 88.5,
      topGoal: 'Tối ưu P99 latency < 80ms và hoàn thiện 45 cột Timesheet',
      status: 'ON_TRACK'
    },
    {
      name: 'Lê Hải Đăng',
      code: 'ACT0156',
      okrCount: 3,
      avgProgress: 76.0,
      topGoal: 'Tích hợp Rule Engine 19 luật linh hoạt và Dry-run simulator',
      status: 'BEHIND'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">Bảng Mục Tiêu Nhóm (Team OKR Board)</h1>
            <Badge variant="accent">S46</Badge>
          </div>
          <p className="text-xs text-ink-muted mt-1">
            Theo dõi sự liên kết mục tiêu cá nhân tới mục tiêu chung của đội ngũ kỹ thuật
          </p>
        </div>
        <div>
          <select
            value={selectedTeam}
            onChange={e => setSelectedTeam(e.target.value)}
            className="text-xs p-2 border border-line rounded-lg bg-surface font-semibold text-ink"
          >
            <option value="Sirius (Core Platform)">Nhóm Sirius (Core Platform)</option>
            <option value="Optimus (AI & Data)">Nhóm Optimus (AI &amp; Data)</option>
            <option value="Zeus (DevOps & Security)">Nhóm Zeus (DevOps &amp; Security)</option>
          </select>
        </div>
      </div>

      {/* Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {members.map(m => (
          <div key={m.code} className="bg-surface rounded-xl border border-line p-5 shadow-2xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-xs text-ink">{m.name}</h3>
                <span className="text-[11px] font-mono text-ink-muted">{m.code}</span>
              </div>
              <Badge variant={m.status === 'ON_TRACK' ? 'ok' : 'warn'}>
                {m.status === 'ON_TRACK' ? 'Đúng hạn' : 'Chậm tiến độ'}
              </Badge>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-ink-muted">Tiến độ trung bình:</span>
                <span className="font-bold text-ink">{m.avgProgress}%</span>
              </div>
              <div className="w-full bg-line rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full"
                  style={{ width: `${m.avgProgress}%` }}
                />
              </div>
            </div>

            <div className="p-3 bg-canvas rounded-lg text-xs space-y-1">
              <span className="text-ink-muted text-[10px] font-bold uppercase tracking-wider">Mục tiêu chính:</span>
              <p className="text-ink font-medium leading-relaxed">{m.topGoal}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
