import React from 'react';
import { GavelTappingLoader } from './GavelTappingLoader';

export type LoadingPhase = 'falling' | 'slammed_waiting' | 'revealing_logo' | 'logo_revealed' | 'moving_up' | 'completed';

interface BetterPOLoaderProps {
  isReady?: boolean;
  onFinish?: () => void;
  standalone?: boolean;
}

export const BetterPOLoader: React.FC<BetterPOLoaderProps> = () => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white text-[#0A1128] font-sans selection:bg-[#68dba9]/30">
      <div className="w-full max-w-md p-6">
        <GavelTappingLoader
          title="Connecting to Chamber..."
          subtitle="SYNCHRONIZING DOCKET, ROSTER & PARLIAMENTARY TELEMETRY"
          soundEnabled={true}
        />
      </div>
    </div>
  );
};

export default BetterPOLoader;
