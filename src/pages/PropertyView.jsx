import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { ArrowLeft, Pencil, MoreHorizontal, Archive } from 'lucide-react';
import { PropertyModal } from '../components/properties/PropertyModal';
import { IconButton } from '../components/ui/IconButton';
import { PageLoader } from '../components/ui/Loading';
import { toast } from 'sonner';

import { DetailsTab }     from '../components/properties/tabs/DetailsTab';
import { TenancyTab }     from '../components/properties/tabs/TenancyTab';
import { OutgoingsTab }   from '../components/properties/tabs/OutgoingsTab';
import { RentReviewsTab } from '../components/properties/tabs/RentReviewsTab';
import { CompsTab }       from '../components/properties/tabs/CompsTab';
import { FeasoTab }       from '../components/properties/tabs/FeasoTab';
import { ReportsTab }     from '../components/properties/tabs/ReportsTab';
import { FilesTab }       from '../components/properties/tabs/FilesTab';
import { PropertyVideos } from '../components/properties/PropertyVideos';
import { PulseFeed }      from '../components/ui/PulseFeed';
import { useGoBack } from '../hooks/useGoBack';

const TABS = [
  { id: 'details',      label: 'Details' },
  { id: 'tenancy',      label: 'Tenancy Schedule' },
  { id: 'outgoings',    label: 'Outgoings' },
  { id: 'rent-reviews', label: 'Rent Reviews' },
  { id: 'comps',        label: 'Comps' },
  { id: 'feaso',        label: 'Feaso' },
  { id: 'reports',      label: 'Reports' },
  { id: 'videos',       label: 'Videos' },
  { id: 'files',        label: 'Deal Vault' },
];

export function PropertyView() {
  const { id } = useParams();
  const goBack = useGoBack('/properties');
  const [activeTab, setActiveTab] = useState('details');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef(null);

  const property        = useQuery(api.properties.getProperty,          id ? { id } : 'skip');
  const updateProperty  = useMutation(api.properties.updateProperty);
  const updateTenants   = useMutation(api.properties.updatePropertyTenants);
  const updateOutgoings = useMutation(api.properties.updatePropertyOutgoings);

  // Resolve brief linked to this property (for Reports tab)
  const propertyMatches = useQuery(
    api.matches.getMatchesForProperty,
    activeTab === 'reports' && id ? { propertyId: id } : 'skip'
  );
  const linkedBriefId = propertyMatches?.[0]?.briefId;
  const linkedBrief   = useQuery(
    api.briefs.getBrief,
    linkedBriefId ? { id: linkedBriefId } : 'skip'
  );

  useEffect(() => {
    if (!showMore) return;
    function handler(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setShowMore(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMore]);

  if (property === undefined) {
    return <PageLoader />;
  }
  if (property === null) {
    return (
      <div className="text-center mt-20">
        <p className="text-brand-100/50">Property not found.</p>
        <button onClick={goBack} className="mt-4 text-brand-500 hover:text-brand-400 text-sm">
          Go Back
        </button>
      </div>
    );
  }

  const daysAdded = Math.floor(
    (Date.now() - (property._creationTime || Date.now())) / (1000 * 60 * 60 * 24)
  );

  return (
    <>
      <div className="flex flex-col bg-[#050505] min-h-full">

        {/* Sticky unit: header + tab bar */}
        <div className="sticky top-0 z-20 bg-[#0A0A0A]">

          {/* Header */}
          <div className="border-b border-white/5 px-6 lg:px-8 py-5 flex items-center justify-between shadow-sm">
            <div className="flex items-center space-x-4 min-w-0">
              <button
                onClick={goBack}
                className="p-1.5 rounded-md bg-white/[0.02] hover:bg-white/[0.06] text-brand-100/50 hover:text-brand-400 transition-all border border-white/5 shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-white truncate">
                  {property.address}
                </h1>
                <p className="text-sm text-brand-100/50 truncate">
                  {property.propertyId ? `${property.propertyId} · ` : ''}
                  Added {daysAdded} day{daysAdded !== 1 ? 's' : ''} ago
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pl-4">
              <IconButton icon={Pencil} label="Edit Property" onClick={() => setIsModalOpen(true)} />
              <div className="relative" ref={moreRef}>
                <IconButton
                  icon={MoreHorizontal}
                  label="More actions"
                  onClick={() => setShowMore((v) => !v)}
                  active={showMore}
                />
                {showMore && (
                  <div className="absolute right-0 top-full mt-1.5 bg-[#161616] border border-white/[0.08] rounded-lg p-1 shadow-2xl z-50 min-w-[160px]">
                    <button
                      onClick={() => { setShowMore(false); toast.info('Archive coming soon'); }}
                      className="w-full flex items-center px-3 py-2 text-xs text-brand-100/60 hover:bg-white/[0.05] hover:text-white rounded-md transition-colors gap-2.5"
                    >
                      <Archive className="w-3.5 h-3.5 text-brand-100/45" />
                      Archive Property
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div className="border-b border-white/[0.06] px-4 lg:px-6 overflow-x-auto scrollbar-none">
            <nav className="flex -mb-px min-w-max">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 text-sm font-medium relative transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-white'
                      : 'text-brand-100/40 hover:text-brand-100/70'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 inset-x-2 h-0.5 bg-brand-500 rounded-t-full" />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab content + Activity panel */}
        <div className="flex-1 flex gap-6 px-6 lg:px-8 py-7 min-h-0">

          {/* Main tab content */}
          <div className="flex-1 min-w-0">
            {activeTab === 'details'      && <DetailsTab     property={property} updateProperty={updateProperty} />}
            {activeTab === 'tenancy'      && <TenancyTab     property={property} updateTenants={updateTenants} />}
            {activeTab === 'outgoings'    && <OutgoingsTab   property={property} updateOutgoings={updateOutgoings} />}
            {activeTab === 'rent-reviews' && <RentReviewsTab property={property} />}
            {activeTab === 'comps'        && <CompsTab       property={property} />}
            {activeTab === 'feaso'        && <FeasoTab       property={property} />}
            {activeTab === 'reports'      && <ReportsTab property={property} brief={linkedBrief ?? null} />}
            {activeTab === 'videos'       && <PropertyVideos property={property} />}
            {activeTab === 'files'        && <FilesTab property={property} />}
          </div>

          {/* Activity panel — fixed width, sticks below header + tab bar */}
          <div className="hidden lg:block w-72 shrink-0">
            <div className="bg-[#0A0A0A] border border-white/5 rounded-xl p-6 sticky top-[140px] max-h-[calc(100vh-160px)] flex flex-col overflow-hidden">
              <PulseFeed recordId={property._id} recordType="property" />
            </div>
          </div>

        </div>
      </div>

      <PropertyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProperty={property}
      />
    </>
  );
}
