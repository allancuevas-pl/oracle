import React from 'react';
import { ArrowUpRight, TrendingUp, Users, Building2 } from 'lucide-react';

const mockPipeline = [
  { id: 1, client: 'Smith Family Office', asset: 'Commercial', stage: 'Triage', value: '$8.5M', updated: '2 hrs ago' },
  { id: 2, client: 'J. Peterson', asset: 'Industrial', stage: 'Feasibility', value: '$4.2M', updated: '5 hrs ago' },
  { id: 3, client: 'Apex Holdings', asset: 'Retail', stage: 'Offer Submitted', value: '$12.0M', updated: '1 day ago' },
];

export function Dashboard() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Overview</h1>
        <p className="text-brand-100/60 text-sm mt-1">Welcome back, Will. Here's what's happening today.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Briefs', value: '12', icon: Users, trend: '+2 this week' },
          { label: 'Properties in DD', value: '4', icon: Building2, trend: '1 requires review' },
          { label: 'Pipeline Value', value: '$42.5M', icon: TrendingUp, trend: 'High conviction' },
        ].map((stat, i) => (
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

      {/* Pipeline Table Mockup */}
      <div className="bg-[#111] border border-brand-800/40 rounded-lg overflow-hidden">
        <div className="px-6 py-5 border-b border-brand-800/40 flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">Active Pipeline</h2>
          <button className="text-sm text-brand-400 hover:text-brand-300 flex items-center">
            View all <ArrowUpRight className="w-4 h-4 ml-1" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-brand-100/50 bg-[#0A0A0A]/50 uppercase border-b border-brand-800/40">
              <tr>
                <th className="px-6 py-3 font-medium">Client</th>
                <th className="px-6 py-3 font-medium">Asset Target</th>
                <th className="px-6 py-3 font-medium">Stage</th>
                <th className="px-6 py-3 font-medium">Est. Value</th>
                <th className="px-6 py-3 font-medium">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {mockPipeline.map((deal) => (
                <tr key={deal.id} className="border-b border-brand-800/20 hover:bg-brand-900/10 transition-colors">
                  <td className="px-6 py-4 font-medium text-brand-50">{deal.client}</td>
                  <td className="px-6 py-4 text-brand-100/70">{deal.asset}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20">
                      {deal.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-brand-100/70">{deal.value}</td>
                  <td className="px-6 py-4 text-brand-100/50">{deal.updated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
