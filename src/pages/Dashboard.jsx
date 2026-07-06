import React from 'react';
import { useQuery } from 'convex/react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../convex/_generated/api';
import { ArrowUpRight, TrendingUp, Users, Building2 } from 'lucide-react';
import { Spinner } from '../components/ui/Loading';
import { formatCurrency } from '../utils/format';

export function Dashboard() {
  const navigate = useNavigate();
  const stats = useQuery(api.dashboard.getDashboardStats);
  const isLoading = stats === undefined;

  const statCards = [
    {
      label: 'Active Briefs',
      value: isLoading ? '—' : String(stats.activeBriefCount),
      icon: Users,
      trend: isLoading
        ? '...'
        : stats.newThisWeek > 0
          ? `+${stats.newThisWeek} this week`
          : 'No new this week',
    },
    {
      label: 'Properties in DD',
      value: isLoading ? '—' : String(stats.propertiesInDD),
      icon: Building2,
      trend: isLoading
        ? '...'
        : stats.propertiesInDD === 1
          ? '1 requires review'
          : `${stats.propertiesInDD} in due diligence`,
    },
    {
      label: 'Pipeline Value',
      value: isLoading ? '—' : formatCurrency(stats.pipelineValue),
      icon: TrendingUp,
      trend: 'Total buyer demand',
    },
  ];

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Overview</h1>
        <p className="text-brand-100/60 text-sm mt-1">
          Here's what's happening in the pipeline.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((stat, i) => (
          <div key={i} className="bg-[#111] border border-brand-800/40 rounded-lg p-5">
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded bg-brand-900/30 flex items-center justify-center">
                <stat.icon className="w-5 h-5 text-brand-400" />
              </div>
              <span className="text-xs font-medium text-brand-500/80 bg-brand-500/10 px-2 py-1 rounded">
                {stat.trend}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-3xl font-semibold">{stat.value}</h3>
              <p className="text-sm text-brand-100/50 mt-1">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Active Pipeline Table */}
      <div className="bg-[#111] border border-brand-800/40 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-brand-800/40 flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Active Pipeline</h2>
          <button
            onClick={() => navigate('/briefs')}
            className="text-sm text-brand-400 hover:text-brand-300 flex items-center transition-colors"
          >
            View all <ArrowUpRight className="w-4 h-4 ml-1" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : stats.recentBriefs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 mb-4 text-brand-500 opacity-30" />
            <p className="text-brand-100/40 text-sm">No active briefs yet.</p>
            <button
              onClick={() => navigate('/briefs')}
              className="mt-3 text-xs text-brand-400 hover:text-brand-300 underline transition-colors"
            >
              Create the first brief
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-brand-100/50 bg-[#0A0A0A]/50 uppercase border-b border-brand-800/40">
                <tr>
                  <th className="px-6 py-3 font-medium">Client</th>
                  <th className="px-6 py-3 font-medium">Asset Target</th>
                  <th className="px-6 py-3 font-medium">Stage</th>
                  <th className="px-6 py-3 font-medium">Budget</th>
                  <th className="px-6 py-3 font-medium">Opened</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentBriefs.map((brief) => (
                  <tr
                    key={brief._id}
                    onClick={() => navigate(`/briefs/${brief._id}`)}
                    className="border-b border-brand-800/20 hover:bg-brand-900/10 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 font-medium text-brand-50">{brief.clientName}</td>
                    <td className="px-6 py-4 text-brand-100/70">{brief.assetTarget}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20">
                        {brief.stage}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-brand-100/70">{formatCurrency(brief.value)}</td>
                    <td className="px-6 py-4 text-brand-100/50">{brief.openedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
