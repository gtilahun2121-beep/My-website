'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AdminUser, AdminRole, roleDisplay, Member, KYCDocument, Dispute, FinancialRecord } from '@/app/types/admin';
import Header from '@/app/components/Header';
import Footer from '@/app/components/Footer';
import { Language, defaultLanguage } from '@/i18n/config';

export default function AdminDashboard() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>(defaultLanguage);
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'kyc' | 'disputes' | 'finance' | 'admin'>('overview');
  const [loading, setLoading] = useState(true);

  // Sample data for demo
  const [members] = useState<Member[]>([
    {
      id: '1',
      phoneNumber: '+251911223344',
      fullName: 'Aisha Mohammed',
      pin: '1234',
      faydaNumber: '12345678',
      email: 'aisha@example.com',
      status: 'active',
      kycStatus: 'approved',
      registeredAt: new Date().toISOString(),
    },
    {
      id: '2',
      phoneNumber: '+251922334455',
      fullName: 'Tigst Kebede',
      pin: '5678',
      faydaNumber: '87654321',
      email: 'tigst@example.com',
      status: 'active',
      kycStatus: 'pending',
      registeredAt: new Date().toISOString(),
    },
  ]);

  const [kycDocs] = useState<KYCDocument[]>([
    {
      id: 'kyc1',
      memberId: '2',
      memberName: 'Tigst Kebede',
      memberPhone: '+251922334455',
      documentType: 'id_photo',
      documentUrl: '/mock-id.jpg',
      submittedAt: new Date().toISOString(),
      status: 'pending',
    },
  ]);

  const [disputes] = useState<Dispute[]>([
    {
      id: 'disp1',
      complainantId: '1',
      complainantName: 'Aisha Mohammed',
      respondentId: '2',
      respondentName: 'Tigst Kebede',
      description: 'Payment not received for round 2',
      status: 'open',
      priority: 'high',
      createdAt: new Date().toISOString(),
    },
  ]);

  const [records] = useState<FinancialRecord[]>([
    {
      id: 'fin1',
      memberId: '1',
      memberName: 'Aisha Mohammed',
      type: 'payment',
      amount: 500,
      currency: 'ETB',
      description: 'Equb round payment',
      status: 'completed',
      date: new Date().toISOString(),
    },
  ]);

  useEffect(() => {
    // Check if admin is logged in
    const adminToken = localStorage.getItem('qalnet_admin_token');
    const adminRole = localStorage.getItem('qalnet_admin_role');

    if (!adminToken || !adminRole) {
      router.push('/auth');
      return;
    }

    // Load admin data
    const adminData = localStorage.getItem(`qalnet_admin_${adminToken}`);
    if (adminData) {
      const parsedAdmin = JSON.parse(adminData);
      setAdmin(parsedAdmin);
    } else {
      router.push('/auth');
    }

    setLoading(false);
  }, [router]);

  if (loading || !admin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-2xl font-black text-[#0d7e4d]">Loading...</div>
      </div>
    );
  }

  const hasPermission = (permission: string) => admin.permissions.includes(permission as any);

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  return (
    <>
      <Header lang={lang} onLanguageChange={setLang} />

      <div className="min-h-screen bg-gradient-to-br from-[#f5f3f0] to-[#ece8e3] py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Admin Header */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="bg-gradient-to-r from-purple-600 to-red-600 rounded-2xl p-6 text-white mb-8 shadow-xl"
          >
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-black mb-2">
                  {roleDisplay[admin.role].icon} Admin Dashboard
                </h1>
                <p className="text-sm">
                  Role: <span className="font-black">{roleDisplay[admin.role].name}</span> | Email: {admin.email}
                </p>
              </div>
              <motion.button
                onClick={() => {
                  localStorage.removeItem('qalnet_admin_token');
                  localStorage.removeItem('qalnet_admin_role');
                  window.location.href = '/auth';
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-full font-bold transition-all"
              >
                🚪 Logout
              </motion.button>
            </div>
          </motion.div>

          {/* Navigation Tabs */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8"
          >
            {[
              { id: 'overview', label: '📊 Overview', permission: null },
              { id: 'members', label: '👥 Members', permission: 'view_members' },
              { id: 'kyc', label: '✅ KYC', permission: 'approve_kyc' },
              { id: 'disputes', label: '⚖️ Disputes', permission: 'manage_disputes' },
              { id: 'finance', label: '💰 Finance', permission: 'view_financial_records' },
              { id: 'admin', label: '⚙️ Admin', permission: 'manage_admin_users' },
            ].map(
              (tab) =>
                (tab.permission === null || hasPermission(tab.permission)) && (
                  <motion.button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`py-3 px-3 font-black rounded-lg transition-all text-sm sm:text-base ${
                      activeTab === tab.id
                        ? 'bg-gradient-to-r from-purple-600 to-red-600 text-white shadow-lg'
                        : 'bg-white text-[#0d7e4d] border-2 border-[#d4af37] hover:shadow-md'
                    }`}
                  >
                    {tab.label}
                  </motion.button>
                )
            )}
          </motion.div>

          {/* Content Sections */}
          {activeTab === 'overview' && (
            <OverviewTab members={members} kycDocs={kycDocs} disputes={disputes} records={records} />
          )}
          {activeTab === 'members' && hasPermission('view_members') && (
            <MembersTab members={members} admin={admin} />
          )}
          {activeTab === 'kyc' && hasPermission('approve_kyc') && (
            <KYCTab documents={kycDocs} />
          )}
          {activeTab === 'disputes' && hasPermission('manage_disputes') && (
            <DisputesTab disputes={disputes} />
          )}
          {activeTab === 'finance' && hasPermission('view_financial_records') && (
            <FinanceTab records={records} />
          )}
          {activeTab === 'admin' && hasPermission('manage_admin_users') && (
            <AdminUsersTab admin={admin} />
          )}
        </div>
      </div>

      <Footer lang={lang} />
    </>
  );
}

// Overview Tab Component
function OverviewTab({ members, kycDocs, disputes, records }: any) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      <StatCard icon="👥" label="Total Members" value={members.length.toString()} />
      <StatCard icon="⏳" label="Pending KYC" value={kycDocs.filter((d: any) => d.status === 'pending').length.toString()} />
      <StatCard icon="🔴" label="Open Disputes" value={disputes.filter((d: any) => d.status === 'open').length.toString()} />
      <StatCard icon="💵" label="Total Transactions" value={records.length.toString()} />
    </div>
  );
}

function StatCard({ icon, label, value }: any) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-white rounded-lg p-4 border-2 border-[#d4af37] shadow-md hover:shadow-lg transition-all"
    >
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-black text-[#0d7e4d]">{value}</p>
    </motion.div>
  );
}

// Members Tab Component
function MembersTab({ members, admin }: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-2xl p-6 shadow-lg"
    >
      <h2 className="text-2xl font-black text-[#0d7e4d] mb-6">Members Management</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-[#d4af37]">
              <th className="text-left py-3 font-black text-[#0d7e4d]">Name</th>
              <th className="text-left py-3 font-black text-[#0d7e4d]">Phone</th>
              <th className="text-left py-3 font-black text-[#0d7e4d]">Status</th>
              <th className="text-left py-3 font-black text-[#0d7e4d]">KYC</th>
              <th className="text-left py-3 font-black text-[#0d7e4d]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member: any) => (
              <tr key={member.id} className="border-b border-gray-200 hover:bg-[#f5f3f0] transition-all">
                <td className="py-3 font-bold text-[#0d7e4d]">{member.fullName}</td>
                <td className="py-3">{member.phoneNumber}</td>
                <td className="py-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-black ${
                    member.status === 'active'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {member.status.toUpperCase()}
                  </span>
                </td>
                <td className="py-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-black ${
                    member.kycStatus === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : member.kycStatus === 'pending'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {member.kycStatus.toUpperCase()}
                  </span>
                </td>
                <td className="py-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-3 py-1 bg-[#0d7e4d] text-white rounded-lg text-xs font-bold hover:shadow-md transition-all"
                  >
                    View
                  </motion.button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// KYC Tab Component
function KYCTab({ documents }: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {documents.map((doc: any) => (
        <motion.div
          key={doc.id}
          whileHover={{ scale: 1.02 }}
          className="bg-white rounded-lg p-4 border-2 border-[#d4af37] shadow-md"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-black text-[#0d7e4d]">{doc.memberName}</h3>
              <p className="text-sm text-gray-600">{doc.memberPhone}</p>
            </div>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">
              {doc.status.toUpperCase()}
            </span>
          </div>
          <p className="text-sm mb-4">Document Type: <strong>{doc.documentType.replace('_', ' ').toUpperCase()}</strong></p>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:shadow-md transition-all"
            >
              ✅ Approve
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 px-4 py-2 bg-red-500 text-white font-bold rounded-lg hover:shadow-md transition-all"
            >
              ❌ Reject
            </motion.button>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// Disputes Tab Component
function DisputesTab({ disputes }: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {disputes.map((dispute: any) => (
        <motion.div
          key={dispute.id}
          whileHover={{ scale: 1.02 }}
          className="bg-white rounded-lg p-4 border-2 border-[#d4af37] shadow-md"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-black text-[#0d7e4d]">
                {dispute.complainantName} vs {dispute.respondentName}
              </h3>
              <p className="text-sm text-gray-600">{dispute.description}</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
              dispute.priority === 'critical' ? 'bg-red-100 text-red-700'
              : dispute.priority === 'high' ? 'bg-orange-100 text-orange-700'
              : 'bg-yellow-100 text-yellow-700'
            }`}>
              {dispute.priority.toUpperCase()}
            </span>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:shadow-md transition-all"
            >
              🔍 Investigate
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-1 px-4 py-2 bg-green-500 text-white font-bold rounded-lg hover:shadow-md transition-all"
            >
              ✓ Resolve
            </motion.button>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}

// Finance Tab Component
function FinanceTab({ records }: any) {
  const totalAmount = records.reduce((sum: number, r: any) => sum + r.amount, 0);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.div
        whileHover={{ scale: 1.05 }}
        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4 mb-6 shadow-md"
      >
        <p className="text-sm">Total Transactions</p>
        <p className="text-3xl font-black">ETB {totalAmount.toLocaleString()}</p>
      </motion.div>

      <div className="bg-white rounded-2xl p-6 shadow-lg">
        <h2 className="text-2xl font-black text-[#0d7e4d] mb-6">Transaction Records</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#d4af37]">
                <th className="text-left py-3 font-black text-[#0d7e4d]">Member</th>
                <th className="text-left py-3 font-black text-[#0d7e4d]">Type</th>
                <th className="text-left py-3 font-black text-[#0d7e4d]">Amount</th>
                <th className="text-left py-3 font-black text-[#0d7e4d]">Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record: any) => (
                <tr key={record.id} className="border-b border-gray-200 hover:bg-[#f5f3f0] transition-all">
                  <td className="py-3 font-bold text-[#0d7e4d]">{record.memberName}</td>
                  <td className="py-3 capitalize">{record.type}</td>
                  <td className="py-3 font-bold">ETB {record.amount}</td>
                  <td className="py-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      record.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {record.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

// Admin Users Tab Component
function AdminUsersTab({ admin }: any) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-2xl p-6 shadow-lg"
    >
      <h2 className="text-2xl font-black text-[#0d7e4d] mb-6">Admin Users Management</h2>
      <p className="text-gray-600 mb-6">Manage admin accounts, roles, and permissions</p>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="px-6 py-3 bg-gradient-to-r from-[#0d7e4d] to-[#d4af37] text-white font-black rounded-full hover:shadow-lg transition-all mb-6"
      >
        ➕ Add New Admin
      </motion.button>

      <div className="bg-[#f5f3f0] border-2 border-[#d4af37] rounded-lg p-4">
        <div className="flex items-center gap-4">
          <div className="text-3xl">👤</div>
          <div>
            <p className="font-black text-[#0d7e4d]">{admin.fullName}</p>
            <p className="text-sm text-gray-600">{admin.email}</p>
            <p className="text-xs font-bold text-[#d4af37]">{admin.role.replace('_', ' ').toUpperCase()}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
