import React from 'react';
import { PortalLogin } from './PortalLogin';
import { PortalDashboard } from './PortalDashboard';
import { useAuth } from '../contexts/AuthContext';

export const StudentPortal: React.FC = () => {
  const { student } = useAuth();

  if (!student) {
    return <PortalLogin />;
  }

  return <PortalDashboard />;
};
