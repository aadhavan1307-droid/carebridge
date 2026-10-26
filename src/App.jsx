import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ReceptionWorkspace from './workspaces/ReceptionWorkspace';
import DoctorWorkspace from './workspaces/DoctorWorkspace';
import AdminWorkspace from './workspaces/AdminWorkspace';

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('carebridge_token') || null);
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('carebridge_user') || 'null'));
  const getInitialRole = () => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      if (path.includes('/login/admin')) return 'admin';
      if (path.includes('/login/reception')) return 'reception';
      if (path.includes('/login/doctor')) return 'doctor';
    }
    return null;
  };

  const [selectedLoginRole, setSelectedLoginRole] = useState(getInitialRole);

  // Application State
  const [stats, setStats] = useState(null);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [resources, setResources] = useState([]);
  const [decisions, setDecisions] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [dischargeRequests, setDischargeRequests] = useState([]);
  const [sseConnected, setSseConnected] = useState(false);

  // Fetch Data from REST API Backend
  const fetchData = async () => {
    const currentToken = localStorage.getItem('carebridge_token');
    if (!currentToken) return;
    try {
      const headers = { 'Authorization': `Bearer ${currentToken}` };
      const [sRes, pRes, dRes, rRes, resRes, decRes, cRes, drRes] = await Promise.all([
        fetch('/api/dashboard/stats', { headers }).then(r => r.ok ? r.json() : null),
        fetch('/api/patients/active', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/doctors', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/rooms', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/resources', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/ai/decisions', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/alerts', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/discharge-requests', { headers }).then(r => r.ok ? r.json() : [])
      ]);

      if (sRes) setStats(sRes);
      setPatients(Array.isArray(pRes) ? pRes : (pRes?.patients || pRes?.data || []));
      setDoctors(Array.isArray(dRes) ? dRes : (dRes?.doctors || dRes?.data || []));
      setRooms(Array.isArray(rRes) ? rRes : (rRes?.rooms || rRes?.data || []));
      setResources(Array.isArray(resRes) ? resRes : (resRes?.resources || resRes?.data || []));
      setDecisions(Array.isArray(decRes) ? decRes : (decRes?.decisions || decRes?.data || []));
      setConflicts(Array.isArray(cRes) ? cRes : (cRes?.conflicts || cRes?.data || []));
      setDischargeRequests(Array.isArray(drRes) ? drRes : (drRes?.requests || drRes?.dischargeRequests || drRes?.data || []));
    } catch (err) {
      console.error('Failed to fetch CareBridge data:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
      const eventSource = new EventSource('/api/events');
      eventSource.onopen = () => setSseConnected(true);
      eventSource.onmessage = () => fetchData();
      eventSource.onerror = () => setSseConnected(false);
      return () => eventSource.close();
    }
  }, [token]);

  const handleLoginSuccess = (newToken, newUser) => {
    localStorage.setItem('carebridge_token', newToken);
    localStorage.setItem('carebridge_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setSelectedLoginRole(null);
  };

  const handleLogout = async () => {
    const savedToken = token;
    localStorage.removeItem('carebridge_token');
    localStorage.removeItem('carebridge_user');
    setToken(null);
    setUser(null);
    setSelectedLoginRole(null);
    if (savedToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
      } catch (err) {
        console.error('Failed to notify backend on logout:', err);
      }
    }
  };

  const handleAdmitPatient = async (payload) => {
    const res = await fetch('/api/patients/admit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to admit patient');
    fetchData();
    return data;
  };

  // Doctor: Create Discharge Request (Clinical Decision)
  const handleCreateDischargeRequest = async (patientId, payload) => {
    const res = await fetch(`/api/patients/${patientId}/discharge-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create discharge request');
    fetchData();
    return data;
  };

  // Doctor: Cancel own discharge request
  const handleCancelDischargeRequest = async (requestId) => {
    const res = await fetch(`/api/discharge-requests/${requestId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to cancel discharge request');
    fetchData();
    return data;
  };

  // Receptionist: Approve Discharge (Administrative Completion)
  const handleApproveDischarge = async (requestId, administrativeNotes, checklist = {}) => {
    const res = await fetch(`/api/discharge-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        administrative_notes: administrativeNotes,
        ...checklist
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to approve discharge');
    fetchData();
    return data;
  };

  // Receptionist: Return Discharge Request for Clarification
  const handleReturnDischarge = async (requestId, clarificationReason) => {
    const res = await fetch(`/api/discharge-requests/${requestId}/return`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ clarification_reason: clarificationReason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to return discharge request');
    fetchData();
    return data;
  };

  // Doctor: Resubmit Returned Discharge Request
  const handleResubmitDischarge = async (requestId, payload) => {
    const res = await fetch(`/api/discharge-requests/${requestId}/resubmit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resubmit discharge request');
    fetchData();
    return data;
  };

  // Receptionist: Reject Discharge Request
  const handleRejectDischarge = async (requestId, rejectionReason) => {
    const res = await fetch(`/api/discharge-requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ rejection_reason: rejectionReason })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reject discharge request');
    fetchData();
    return data;
  };

  const handleReplan = async (triggerType) => {
    const res = await fetch('/api/ai/replan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ trigger_type: triggerType })
    });
    const data = await res.json();
    fetchData();
    return data;
  };

  // 1. Not Authenticated: Render Landing or Login
  if (!token || !user) {
    if (selectedLoginRole) {
      return (
        <LoginPage
          loginRole={selectedLoginRole}
          onLoginSuccess={handleLoginSuccess}
          onBack={() => setSelectedLoginRole(null)}
        />
      );
    }
    return <LandingPage onSelectLogin={setSelectedLoginRole} />;
  }

  // 2. Authenticated: Render Role Workspace
  if (user.role === 'RECEPTIONIST') {
    return (
      <ReceptionWorkspace
        user={user}
        token={token}
        patients={patients}
        dischargeRequests={dischargeRequests}
        onAdmitPatient={handleAdmitPatient}
        onApproveDischarge={handleApproveDischarge}
        onReturnDischarge={handleReturnDischarge}
        onRejectDischarge={handleRejectDischarge}
        onRefresh={fetchData}
        onLogout={handleLogout}
      />
    );
  }

  if (user.role === 'DOCTOR') {
    return (
      <DoctorWorkspace
        user={user}
        token={token}
        patients={patients}
        dischargeRequests={dischargeRequests}
        onCreateDischargeRequest={handleCreateDischargeRequest}
        onCancelDischargeRequest={handleCancelDischargeRequest}
        onResubmitDischarge={handleResubmitDischarge}
        onRefresh={fetchData}
        onLogout={handleLogout}
      />
    );
  }

  // ADMIN default
  return (
    <AdminWorkspace
      user={user}
      token={token}
      stats={stats}
      patients={patients}
      doctors={doctors}
      rooms={rooms}
      resources={resources}
      decisions={decisions}
      conflicts={conflicts}
      dischargeRequests={dischargeRequests}
      sseConnected={sseConnected}
      onAdmitPatient={handleAdmitPatient}
      onApproveDischarge={handleApproveDischarge}
      onRejectDischarge={handleRejectDischarge}
      onReplan={handleReplan}
      onRefresh={fetchData}
      onLogout={handleLogout}
    />
  );
}
