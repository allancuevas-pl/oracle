import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Universal 3-Column Workspace Shell (HubSpot Style)
 * Standardizes the view for Briefs, Properties, Contacts, etc.
 */
export function RecordWorkspace({ 
  onBack, 
  title, 
  subtitle, 
  statusControls, 
  actions, 
  leftColumn, 
  centerColumn, 
  rightColumn 
}) {
  const navigate = useNavigate();
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="flex flex-col bg-[#050505] min-h-[calc(100vh-theme(spacing.16))]">
      
      {/* 1. Header Area */}
      <div className="flex-none bg-[#0A0A0A] border-b border-brand-800/30 px-6 lg:px-8 py-5 flex items-center justify-between z-10 sticky top-0">
        <div className="flex items-center space-x-4">
          <button 
            onClick={handleBack}
            className="p-1.5 rounded-md bg-brand-900/10 hover:bg-brand-900/30 text-brand-100/50 hover:text-brand-400 transition-colors border border-brand-800/30 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="min-w-0">
            <div className="flex items-center space-x-3 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight text-white truncate">{title}</h1>
            </div>
            {subtitle && (
              <p className="text-sm text-brand-100/50 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        
        {/* Top Right Action Bar */}
        <div className="flex items-center space-x-4 shrink-0 pl-4">
          {statusControls && (
            <div className="flex items-center space-x-2 border-r border-brand-800/30 pr-4 mr-1">
              {statusControls}
            </div>
          )}
          <div className="flex items-center space-x-3">
            {actions}
          </div>
        </div>
      </div>

      {/* 2. Scrollable 3-Column Canvas (with Rounded Shells) */}
      <div className="flex-1 p-4 lg:p-6 overflow-x-hidden">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 h-full items-stretch">
          
          {/* Left Column (25%) - Static Data */}
          <div className="w-full lg:w-1/4 min-w-[280px] bg-[#0A0A0A] border border-brand-800/30 rounded-xl p-6 shadow-md overflow-hidden">
            {leftColumn}
          </div>
          
          {/* Center Column (50%) - The Feed / Pipeline */}
          <div className="flex-1 min-w-[320px] bg-[#0A0A0A] border border-brand-800/30 rounded-xl p-6 shadow-md overflow-hidden">
            {centerColumn}
          </div>
          
          {/* Right Column (25%) - Activity / Associations */}
          <div className="w-full lg:w-1/4 min-w-[280px] bg-[#0A0A0A] border border-brand-800/30 rounded-xl p-6 shadow-md overflow-hidden">
            {rightColumn}
          </div>
          
        </div>
      </div>
    </div>
  );
}
