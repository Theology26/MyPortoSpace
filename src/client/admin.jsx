
    const { useState, useEffect } = React;

    const AdminApp = () => {
      const [isAuthenticated, setIsAuthenticated] = useState(false);
      const [passcode, setPasscode] = useState('');
      const [loginError, setLoginError] = useState('');
      const [activeTab, setActiveTab] = useState('hero');
      const [content, setContent] = useState(null);
      const [loading, setLoading] = useState(true);
      const [saving, setSaving] = useState(false);
      const [toast, setToast] = useState(null);
      const [githubSyncing, setGithubSyncing] = useState(false);
      const [oldPass, setOldPass] = useState('');
      const [newPass, setNewPass] = useState('');
      const [confirmPass, setConfirmPass] = useState('');
      const [passError, setPassError] = useState('');
      const [passChanging, setPassChanging] = useState(false);
      const [showOldPass, setShowOldPass] = useState(false);
      const [showNewPass, setShowNewPass] = useState(false);

      const showToast = (msg, type = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 4000);
      };

      // Check existing session
      useEffect(() => {
        const token = sessionStorage.getItem('theo_admin_token');
        if (token) {
          setIsAuthenticated(true);
          fetchContent(token);
        } else {
          setLoading(false);
        }
      }, []);

      const fetchContent = async (token) => {
        try {
          setLoading(true);
          const res = await fetch('/api/content');
          const json = await res.json();
          if (json.success) {
            setContent(json.data);
          }
        } catch (err) {
          showToast('Failed to fetch database content', 'error');
        } finally {
          setLoading(false);
        }
      };

      const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passcode }),
          });
          const json = await res.json();
          if (json.success) {
            sessionStorage.setItem('theo_admin_token', json.token);
            setIsAuthenticated(true);
            fetchContent(json.token);
            showToast('Access Authorized // Welcome to Systems Admin');
          } else {
            setLoginError(json.error || 'Invalid passcode');
          }
        } catch (err) {
          setLoginError('Server connection error');
        }
      };

      const handleLogout = () => {
        sessionStorage.removeItem('theo_admin_token');
        setIsAuthenticated(false);
        setPasscode('');
      };

      const handleSave = async () => {
        setSaving(true);
        const token = sessionStorage.getItem('theo_admin_token');
        try {
          const res = await fetch('/api/content', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(content),
          });
          const json = await res.json();
          if (json.success) {
            setContent(json.data);
            showToast('✓ All changes saved to SQLite database successfully!');
          } else {
            showToast(json.error || 'Failed to save changes', 'error');
          }
        } catch (err) {
          showToast('Network error while saving data', 'error');
        } finally {
          setSaving(false);
        }
      };

      const handleSyncGithub = async () => {
        setGithubSyncing(true);
        try {
          const res = await fetch('/api/github/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: content.general.githubUsername,
              token: content.general.githubToken,
            }),
          });
          const json = await res.json();
          if (json.success) {
            if (json.projectsList && Array.isArray(json.projectsList)) {
              setContent(prev => ({
                ...prev,
                projectsList: json.projectsList
              }));
            }
            showToast(json.message || `✓ GitHub Sync Success: ${json.count} repositories synchronized to database!`);
          } else {
            showToast(json.error || 'GitHub Sync Failed', 'error');
          }
        } catch (err) {
          showToast('Failed to connect to GitHub API', 'error');
        } finally {
          setGithubSyncing(false);
        }
      };

      // Helper for deep mutations
      const handleChangePasscode = async (e) => {
        e.preventDefault();
        setPassError('');

        if (!oldPass) {
          setPassError('Password lama harus diisi.');
          return;
        }
        if (!newPass) {
          setPassError('Password baru harus diisi.');
          return;
        }
        if (newPass.length < 6) {
          setPassError('Password baru minimal 6 karakter.');
          return;
        }
        if (newPass !== confirmPass) {
          setPassError('Konfirmasi password baru tidak cocok.');
          return;
        }

        setPassChanging(true);
        const token = sessionStorage.getItem('theo_admin_token');
        try {
          const res = await fetch('/api/auth/change-passcode', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              currentPasscode: oldPass,
              newPasscode: newPass
            })
          });
          const json = await res.json();
          if (json.success) {
            if (json.token) {
              sessionStorage.setItem('theo_admin_token', json.token);
            }
            setOldPass('');
            setNewPass('');
            setConfirmPass('');
            showToast('✓ Password admin berhasil diperbarui!');
          } else {
            setPassError(json.error || 'Gagal mengubah password');
          }
        } catch (err) {
          setPassError('Terjadi kesalahan koneksi server');
        } finally {
          setPassChanging(false);
        }
      };

      const updateField = (section, field, value) => {
        setContent(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            [field]: value,
          },
        }));
      };

      // Section 04 (Technical Arsenal) — the server seeds defaults for this
      // section. Optional chaining matters: this runs on every render, including
      // the first one while `content` is still null.
      const arsenal = content?.techArsenal || {};
      const arsenalCards = Array.isArray(arsenal.cards) ? arsenal.cards : [];

      // Image File Upload to DataURL
      // ═══════════════════════════════════════════
      // Image upload
      //
      // Files are POSTed to /api/upload and stored on disk; the content JSON
      // only ever holds the resulting URL. Base64 was never viable here: it
      // inflates payloads ~33% and would bloat the public /api/content
      // response with every certificate image.
      // ═══════════════════════════════════════════
      const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

      const uploadImage = async (file) => {
        const formData = new FormData();
        formData.append('image', file);
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionStorage.getItem('theo_admin_token')}` },
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || `Upload failed (${res.status})`);
        return data.url;
      };

      const handleImageUpload = async (file, targetSection) => {
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
          showToast('Image file size exceeds 5MB. Please choose a smaller image.', 'error');
          return;
        }
        try {
          showToast('Uploading image...');
          const url = await uploadImage(file);
          if (targetSection === 'lanyard') {
            updateField('lanyard', 'avatarUrl', url);
            updateField('cvData', 'avatarUrl', url);
            showToast('✓ Profile photo updated for Lanyard Badge & ATS CV!');
          } else if (targetSection === 'cvData') {
            updateField('cvData', 'avatarUrl', url);
            showToast('✓ ATS CV Profile Photo updated!');
          }
        } catch (err) {
          showToast(err.message, 'error');
        }
      };

      // Project image upload
      const handleProjectItemImageUpload = async (file, index) => {
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
          showToast('Project image exceeds 5MB. Please choose a smaller file.', 'error');
          return;
        }
        try {
          showToast('Uploading image...');
          const url = await uploadImage(file);
          setContent(prev => {
            const list = [...(prev.projectsList || [])];
            if (list[index]) list[index] = { ...list[index], imageUrl: url };
            return { ...prev, projectsList: list };
          });
          showToast('✓ Project image uploaded successfully!');
        } catch (err) {
          showToast(err.message, 'error');
        }
      };

      // Certificate image upload
      const handleCertItemImageUpload = async (file, index) => {
        if (!file) return;
        if (file.size > MAX_UPLOAD_BYTES) {
          showToast('Certificate photo exceeds 5MB. Please choose a smaller file.', 'error');
          return;
        }
        try {
          showToast('Uploading image...');
          const url = await uploadImage(file);
          setContent(prev => {
            const list = [...(prev.certificatesList || [])];
            if (list[index]) list[index] = { ...list[index], imageUrl: url };
            return { ...prev, certificatesList: list };
          });
          showToast('✓ Certificate photo uploaded successfully!');
        } catch (err) {
          showToast(err.message, 'error');
        }
      };

      // Login Screen
      if (!isAuthenticated) {
        return (
          <div className="min-h-screen flex items-center justify-center p-6 bg-space-black relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute w-96 h-96 rounded-full bg-cyan-500/10 blur-[120px] top-1/4 left-1/4" />
            <div className="absolute w-96 h-96 rounded-full bg-blue-600/10 blur-[140px] bottom-1/4 right-1/4" />

            <div className="glass-card-strong rounded-3xl p-8 max-w-md w-full relative z-10 border border-white/15 shadow-2xl">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-xs font-semibold tracking-wider text-muted uppercase">
                  SECURITY PROTOCOL // AUTHORIZED ONLY
                </span>
              </div>
              <h1 className="font-geist text-2xl font-bold text-white mb-2 tracking-tight">
                Systems Admin Console
              </h1>
              <p className="font-geist text-sm text-muted mb-6">
                Enter your developer master passcode to access the live SQLite CMS and database controls.
              </p>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div>
                  <label className="font-mono text-xs text-muted block mb-1.5 uppercase">Master Passcode</label>
                  <input
                    type="password"
                    placeholder="Enter security passcode..."
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    className="glass-input w-full px-4 py-3 rounded-xl font-mono text-sm"
                    required
                  />
                  {loginError && (
                    <span className="font-mono text-xs text-rose-400 mt-1.5 block">
                      ⚠ {loginError}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-white text-space-black font-geist text-sm font-semibold hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  Unlock Admin Dashboard →
                </button>

                <div className="pt-2 text-center">
                  <a href="/" className="font-mono text-xs text-muted hover:text-white transition-colors">
                    ← Return to Public Portfolio
                  </a>
                </div>
              </form>
            </div>
          </div>
        );
      }

      if (loading || !content) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-space-black text-white font-mono text-sm">
            <span className="animate-spin inline-block mr-3">⟳</span> Connecting to SQLite Database...
          </div>
        );
      }

      const tabs = [
        { id: 'hero', label: '01 // Hero & Brand' },
        { id: 'lanyard', label: '02 // Lanyard Pass' },
        { id: 'skills', label: '03 // Tech Stacks' },
        { id: 'certificates', label: '04 // Certificates' },
        { id: 'projects', label: '05 // Projects & Repos' },
        { id: 'cv', label: '06 // ATS CV Generator' },
        { id: 'github', label: '07 // GitHub Engine' },
        { id: 'space', label: '08 // Space 3D Settings' },
        { id: 'security', label: '09 // Security & Passcode' },
      ];

      return (
        <div className="min-h-screen bg-space-black text-slate-200 pb-24">
          {/* Top Bar Navigation */}
          <header className="sticky top-0 z-50 glass-card-strong border-b border-white/10 px-8 py-4 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border border-cyan-400/40 overflow-hidden shadow-[0_0_10px_rgba(6,182,212,0.3)] shrink-0">
                  <img
                    src={content.general.logoUrl || '/Assets/avatar_animated.png'}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-mono text-xs font-bold text-white tracking-wide uppercase">
                    {content.general.brandName} // SYSTEM CMS
                  </div>
                  <div className="font-mono text-[10px] text-muted">
                    SQLITE DATABASE ACTIVE • PORT 3000
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <a
                  href="/"
                  target="_blank"
                  className="glass-pill px-4 py-2 rounded-full font-geist text-xs text-muted hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
                >
                  View Live Site ↗
                </a>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 rounded-full bg-white text-space-black font-geist text-xs font-semibold hover:bg-white/90 active:scale-[0.98] transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <span className="animate-spin">⟳</span> Saving...
                    </>
                  ) : (
                    <>
                      <span>💾</span> Save All Changes
                    </>
                  )}
                </button>

                <button
                  onClick={handleLogout}
                  className="glass-pill px-3 py-2 rounded-full font-mono text-xs text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Logout"
                >
                  Exit ⏻
                </button>
              </div>
            </div>
          </header>

          {/* Toast Notification */}
          {toast && (
            <div className={`fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl font-mono text-xs shadow-2xl flex items-center gap-2 border ${
              toast.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-500/40'
                : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
            }`}>
              <span>{toast.type === 'error' ? '⚠' : '✓'}</span>
              <span>{toast.msg}</span>
            </div>
          )}

          {/* Main Layout */}
          <main className="max-w-7xl mx-auto px-8 pt-8">
            {/* Tabs Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-white/10">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-2 rounded-xl font-mono text-xs transition-all whitespace-nowrap ${
                    activeTab === t.id
                      ? 'bg-white text-space-black font-semibold shadow-md'
                      : 'glass-pill text-muted hover:text-white hover:bg-white/10'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB 1: HERO & BRAND */}
            {activeTab === 'hero' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card rounded-2xl p-6 flex flex-col gap-4">
                  <h2 className="font-geist text-lg font-semibold text-white border-b border-white/10 pb-2">
                    Hero Typography & Headings
                  </h2>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Architecture Chip Badge</label>
                    <input
                      type="text"
                      value={content.hero.badgeText}
                      onChange={(e) => updateField('hero', 'badgeText', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Architecture Chip Subtext</label>
                    <input
                      type="text"
                      value={content.hero.badgeSubtext}
                      onChange={(e) => updateField('hero', 'badgeSubtext', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Eyebrow Greeting</label>
                    <input
                      type="text"
                      value={content.hero.eyebrow}
                      onChange={(e) => updateField('hero', 'eyebrow', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Main Title (Line 1)</label>
                    <input
                      type="text"
                      value={content.hero.titleLine1}
                      onChange={(e) => updateField('hero', 'titleLine1', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-bold text-base"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Title Gradient Accent (Line 2)</label>
                    <input
                      type="text"
                      value={content.hero.titleLine2}
                      onChange={(e) => updateField('hero', 'titleLine2', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-bold text-base text-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Description Paragraph</label>
                    <textarea
                      rows="4"
                      value={content.hero.description}
                      onChange={(e) => updateField('hero', 'description', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm leading-relaxed"
                    />
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-6 flex flex-col gap-4">
                  <h2 className="font-geist text-lg font-semibold text-white border-b border-white/10 pb-2">
                    Action Buttons & Brand Configuration
                  </h2>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Primary CTA Button Text</label>
                    <input
                      type="text"
                      value={content.hero.ctaPrimaryText}
                      onChange={(e) => updateField('hero', 'ctaPrimaryText', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Primary CTA Link / Anchor</label>
                    <input
                      type="text"
                      value={content.hero.ctaPrimaryLink}
                      onChange={(e) => updateField('hero', 'ctaPrimaryLink', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">CV Download Button Label</label>
                    <input
                      type="text"
                      value={content.hero.ctaSecondaryText}
                      onChange={(e) => updateField('hero', 'ctaSecondaryText', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Linktree Button Text</label>
                    <input
                      type="text"
                      value={content.hero.ctaTertiaryText}
                      onChange={(e) => updateField('hero', 'ctaTertiaryText', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Linktree URL</label>
                    <input
                      type="text"
                      value={content.general.linktreeUrl}
                      onChange={(e) => updateField('general', 'linktreeUrl', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Brand Name & Domain</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={content.general.brandName}
                        onChange={(e) => updateField('general', 'brandName', e.target.value)}
                        className="glass-input px-3 py-2 rounded-lg font-mono text-xs"
                        placeholder="THEOLOGY26"
                      />
                      <input
                        type="text"
                        value={content.general.brandDomain}
                        onChange={(e) => updateField('general', 'brandDomain', e.target.value)}
                        className="glass-input px-3 py-2 rounded-lg font-mono text-xs"
                        placeholder="theo.dev"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Brand Animated Avatar Logo URL</label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full border border-cyan-400/40 overflow-hidden shrink-0 bg-white/5 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                        <img
                          src={content.general.logoUrl || '/Assets/avatar_animated.png'}
                          alt="Brand Logo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <input
                        type="text"
                        value={content.general.logoUrl || '/Assets/avatar_animated.png'}
                        onChange={(e) => updateField('general', 'logoUrl', e.target.value)}
                        className="glass-input flex-1 px-3 py-2 rounded-lg font-mono text-xs"
                        placeholder="/Assets/avatar_animated.png"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LANYARD PASS */}
            {activeTab === 'lanyard' && (
              <div className="glass-card rounded-2xl p-6 max-w-2xl mx-auto flex flex-col gap-5">
                <div className="border-b border-white/10 pb-3">
                  <h2 className="font-geist text-lg font-semibold text-white">
                    Interactive Lanyard Pass & Photo Identity
                  </h2>
                  <p className="font-geist text-xs text-muted mt-0.5">
                    Upload your custom photo to appear on the 3D lanyard pass (replaces the 'TG' monogram) and synchronize with your ATS CV.
                  </p>
                </div>

                {/* Profile Photo & Avatar Uploader */}
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-center gap-5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-cyan-400/60 bg-black/40 shadow-lg shrink-0">
                      {content.lanyard?.avatarUrl ? (
                        <img
                          src={content.lanyard.avatarUrl}
                          alt="Avatar Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-geist text-2xl font-bold text-white tracking-tight">
                          {content.lanyard?.monogram || 'TG'}
                        </span>
                      )}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-black flex items-center justify-center text-[10px] text-white">✓</span>
                  </div>

                  <div className="flex-1 flex flex-col gap-2.5 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-4 py-2 rounded-xl bg-cyan-500 text-space-black font-geist text-xs font-bold hover:bg-cyan-400 cursor-pointer transition-all inline-flex items-center gap-1.5 shadow-md">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                        Upload Photo File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleImageUpload(e.target.files[0], 'lanyard')}
                        />
                      </label>
                      {content.lanyard?.avatarUrl && (
                        <button
                          type="button"
                          onClick={() => {
                            updateField('lanyard', 'avatarUrl', '');
                            showToast('Photo removed. Pass reverted to TG monogram.');
                          }}
                          className="px-3 py-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs font-mono hover:bg-rose-500/20 transition-all"
                        >
                          Revert to Monogram
                        </button>
                      )}
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Or paste image URL (https://...)"
                        value={content.lanyard?.avatarUrl || ''}
                        onChange={(e) => {
                          updateField('lanyard', 'avatarUrl', e.target.value);
                          updateField('cvData', 'avatarUrl', e.target.value);
                        }}
                        className="glass-input w-full px-3 py-1.5 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Pass Header</label>
                    <input
                      type="text"
                      value={content.lanyard.passHeader}
                      onChange={(e) => updateField('lanyard', 'passHeader', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Pass Status</label>
                    <input
                      type="text"
                      value={content.lanyard.passStatus}
                      onChange={(e) => updateField('lanyard', 'passStatus', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Monogram</label>
                    <input
                      type="text"
                      value={content.lanyard.monogram}
                      onChange={(e) => updateField('lanyard', 'monogram', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-sm font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="font-mono text-xs text-muted block mb-1">Full Name</label>
                    <input
                      type="text"
                      value={content.lanyard.userName}
                      onChange={(e) => updateField('lanyard', 'userName', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">Job Title / Subtitle</label>
                  <input
                    type="text"
                    value={content.lanyard.userTitle}
                    onChange={(e) => updateField('lanyard', 'userTitle', e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">University / Alumnus</label>
                  <input
                    type="text"
                    value={content.lanyard.userAlumnus}
                    onChange={(e) => updateField('lanyard', 'userAlumnus', e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">ID Number</label>
                    <input
                      type="text"
                      value={content.lanyard.idNumber}
                      onChange={(e) => updateField('lanyard', 'idNumber', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Issuance / Node</label>
                    <input
                      type="text"
                      value={content.lanyard.issuanceNode}
                      onChange={(e) => updateField('lanyard', 'issuanceNode', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">Core Architecture Tagline</label>
                  <input
                    type="text"
                    value={content.lanyard.coreArch}
                    onChange={(e) => updateField('lanyard', 'coreArch', e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">Woven Fabric Strap Curved Text</label>
                  <input
                    type="text"
                    value={content.lanyard.ribbonText}
                    onChange={(e) => updateField('lanyard', 'ribbonText', e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs tracking-wider"
                  />
                </div>
              </div>
            )}

            {/* TAB 3: TECH STACKS */}
            {activeTab === 'skills' && (
              <div className="glass-card rounded-2xl p-6 max-w-2xl mx-auto flex flex-col gap-4">
                <h2 className="font-geist text-lg font-semibold text-white border-b border-white/10 pb-2">
                  Core Technical Substrates (Pill Tags)
                </h2>

                <div className="flex flex-wrap gap-2 py-3">
                  {content.techTags.map((tag, idx) => (
                    <div key={idx} className="glass-pill px-3 py-1.5 rounded-full flex items-center gap-2">
                      <span className="font-mono text-xs text-white">{tag}</span>
                      <button
                        onClick={() => {
                          const updated = content.techTags.filter((_, i) => i !== idx);
                          setContent(prev => ({ ...prev, techTags: updated }));
                        }}
                        className="text-rose-400 hover:text-rose-300 text-xs"
                        title="Remove tag"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                  <input
                    id="newTagInput"
                    type="text"
                    placeholder="Enter new technology name (e.g., Redis, Docker, GraphQL)"
                    className="glass-input flex-1 px-4 py-2.5 rounded-xl font-mono text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = e.target.value.trim();
                        if (val && !content.techTags.includes(val)) {
                          setContent(prev => ({ ...prev, techTags: [...prev.techTags, val] }));
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      const inp = document.getElementById('newTagInput');
                      const val = inp.value.trim();
                      if (val && !content.techTags.includes(val)) {
                        setContent(prev => ({ ...prev, techTags: [...prev.techTags, val] }));
                        inp.value = '';
                      }
                    }}
                    className="px-5 py-2.5 rounded-xl bg-white text-space-black font-geist text-xs font-semibold hover:bg-white/90"
                  >
                    + Add Tag
                  </button>
                </div>

                {/* 04 // TECHNICAL ARSENAL — everything except the language bars */}
                <div className="pt-5 mt-2 border-t border-white/10 flex flex-col gap-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-geist text-base font-semibold text-white">
                        Section 04 — Technical Arsenal
                      </h2>
                      <p className="font-geist text-xs text-muted mt-0.5">
                        Headings, the Tech Stack card, and the architecture cards on the right. The language
                        percentages stay automatic from the GitHub API.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="font-mono text-[10px] text-muted block mb-1">Section Label</label>
                      <input
                        type="text"
                        value={arsenal.label || ''}
                        onChange={(e) => updateField('techArsenal', 'label', e.target.value)}
                        className="glass-input w-full px-3 py-1.5 rounded-lg font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] text-muted block mb-1">Section Title</label>
                      <input
                        type="text"
                        value={arsenal.title || ''}
                        onChange={(e) => updateField('techArsenal', 'title', e.target.value)}
                        className="glass-input w-full px-3 py-1.5 rounded-lg font-semibold text-sm"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] text-muted block mb-1">Section Subtitle</label>
                      <textarea
                        rows="2"
                        value={arsenal.subtitle || ''}
                        onChange={(e) => updateField('techArsenal', 'subtitle', e.target.value)}
                        className="glass-input w-full px-3 py-1.5 rounded-lg text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="font-mono text-[10px] text-muted block mb-1">Tech Stack Card Title</label>
                        <input
                          type="text"
                          value={arsenal.stackTitle || ''}
                          onChange={(e) => updateField('techArsenal', 'stackTitle', e.target.value)}
                          className="glass-input w-full px-3 py-1.5 rounded-lg font-semibold text-xs"
                        />
                      </div>
                      <div>
                        <label className="font-mono text-[10px] text-muted block mb-1">Tech Stack Card Subtitle</label>
                        <input
                          type="text"
                          value={arsenal.stackSubtitle || ''}
                          onChange={(e) => updateField('techArsenal', 'stackSubtitle', e.target.value)}
                          className="glass-input w-full px-3 py-1.5 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-mono text-[10px] text-muted block mb-1">Tech Stack Footer Label</label>
                      <input
                        type="text"
                        value={arsenal.stackFooterLabel || ''}
                        onChange={(e) => updateField('techArsenal', 'stackFooterLabel', e.target.value)}
                        className="glass-input w-full px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase"
                      />
                    </div>
                  </div>

                  {/* Architecture cards */}
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-mono text-xs text-muted uppercase">Architecture Cards</label>
                      <button
                        onClick={() => updateField('techArsenal', 'cards', [
                          ...arsenalCards,
                          { badge: 'NEW CARD', title: 'Card Title', description: 'Card description.', tags: [], accent: 'cyan' },
                        ])}
                        className="font-mono text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        + Add Card
                      </button>
                    </div>

                    <div className="flex flex-col gap-4">
                      {arsenalCards.map((card, cIdx) => (
                        <div key={cIdx} className="glass-pill p-4 rounded-xl flex flex-col gap-2.5 relative">
                          <div className="flex items-center justify-between pr-6">
                            <span className="font-mono text-[10px] text-muted">Card {cIdx + 1}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  if (cIdx === 0) return;
                                  const copy = [...arsenalCards];
                                  [copy[cIdx - 1], copy[cIdx]] = [copy[cIdx], copy[cIdx - 1]];
                                  updateField('techArsenal', 'cards', copy);
                                }}
                                disabled={cIdx === 0}
                                className="font-mono text-xs text-muted hover:text-white disabled:opacity-30 px-1.5"
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => {
                                  if (cIdx === arsenalCards.length - 1) return;
                                  const copy = [...arsenalCards];
                                  [copy[cIdx + 1], copy[cIdx]] = [copy[cIdx], copy[cIdx + 1]];
                                  updateField('techArsenal', 'cards', copy);
                                }}
                                disabled={cIdx === arsenalCards.length - 1}
                                className="font-mono text-xs text-muted hover:text-white disabled:opacity-30 px-1.5"
                                title="Move down"
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => {
                                  if (arsenalCards.length <= 1) return;
                                  updateField('techArsenal', 'cards', arsenalCards.filter((_, i) => i !== cIdx));
                                }}
                                disabled={arsenalCards.length <= 1}
                                className="text-rose-400 hover:text-rose-300 text-xs px-2 disabled:opacity-30"
                                title="Remove card"
                              >
                                ×
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <input
                              type="text"
                              placeholder="Badge label"
                              value={card.badge || ''}
                              onChange={(e) => {
                                const copy = [...arsenalCards];
                                copy[cIdx] = { ...copy[cIdx], badge: e.target.value };
                                updateField('techArsenal', 'cards', copy);
                              }}
                              className="glass-input px-3 py-1.5 rounded-lg font-mono text-[10px] uppercase col-span-2"
                            />
                            <select
                              value={card.accent || 'cyan'}
                              onChange={(e) => {
                                const copy = [...arsenalCards];
                                copy[cIdx] = { ...copy[cIdx], accent: e.target.value };
                                updateField('techArsenal', 'cards', copy);
                              }}
                              className="glass-input px-2.5 py-1.5 rounded-lg font-mono text-[10px] bg-black/60 border-white/20"
                            >
                              <option value="cyan" className="bg-slate-900 text-cyan-300">CYAN ACCENT</option>
                              <option value="purple" className="bg-slate-900 text-purple-300">PURPLE ACCENT</option>
                            </select>
                          </div>

                          <input
                            type="text"
                            placeholder="Card title"
                            value={card.title || ''}
                            onChange={(e) => {
                              const copy = [...arsenalCards];
                              copy[cIdx] = { ...copy[cIdx], title: e.target.value };
                              updateField('techArsenal', 'cards', copy);
                            }}
                            className="glass-input px-3 py-1.5 rounded-lg font-semibold text-sm"
                          />

                          <textarea
                            rows="3"
                            placeholder="Card description..."
                            value={card.description || ''}
                            onChange={(e) => {
                              const copy = [...arsenalCards];
                              copy[cIdx] = { ...copy[cIdx], description: e.target.value };
                              updateField('techArsenal', 'cards', copy);
                            }}
                            className="glass-input w-full px-3 py-1.5 rounded-lg text-xs"
                          />

                          <div>
                            <label className="font-mono text-[10px] text-muted block mb-1">
                              Tags (comma separated) — renders as pills
                            </label>
                            <input
                              type="text"
                              placeholder="Laravel 11, PHP 8.3, MySQL"
                              value={(Array.isArray(card.tags) ? card.tags : []).join(', ')}
                              onChange={(e) => {
                                const copy = [...arsenalCards];
                                copy[cIdx] = {
                                  ...copy[cIdx],
                                  tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                                };
                                updateField('techArsenal', 'cards', copy);
                              }}
                              className="glass-input w-full px-3 py-1.5 rounded-lg font-mono text-xs"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: CERTIFICATES (Instagram Feed Style) */}
            {activeTab === 'certificates' && (
              <div className="glass-card rounded-2xl p-6 max-w-4xl mx-auto flex flex-col gap-6">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <h2 className="font-geist text-lg font-semibold text-white flex items-center gap-2">
                      <span>Certificates & Credentials (IG Feed)</span>
                      <span className="glass-pill px-2.5 py-0.5 rounded-full font-mono text-[10px] text-emerald-300">
                        {(content.certificatesList || []).length} Verified Items
                      </span>
                    </h2>
                    <p className="font-geist text-xs text-muted mt-1">
                      Displayed above Projects & Repositories in a dynamic Instagram / Pinterest Masonry grid. Each card has a direct link, title, and customizable aspect ratio.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const newCert = {
                        id: 'cert-' + Date.now(),
                        title: 'New Certification Title',
                        issuer: 'Certification Authority',
                        imageUrl: '',
                        linkUrl: 'https://github.com/Theology26',
                        aspectRatio: 'aspect-[4/5]',
                        badge: 'OFFICIAL CREDENTIAL',
                        date: new Date().getFullYear().toString()
                      };
                      const updated = [...(content.certificatesList || []), newCert];
                      setContent(prev => ({ ...prev, certificatesList: updated }));
                      showToast('+ New certificate added!');
                    }}
                    className="px-4 py-2 rounded-xl bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 font-mono text-xs hover:bg-emerald-600/50 transition-all flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  >
                    <span>+ Add Certificate</span>
                  </button>
                </div>

                {/* Certificates List */}
                <div className="flex flex-col gap-5">
                  {(content.certificatesList || []).map((cert, cIdx) => (
                    <div key={cert.id || cIdx} className="glass-pill p-5 rounded-2xl flex flex-col gap-4 border border-emerald-500/30 bg-emerald-950/10">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-emerald-400 font-bold">#{cIdx + 1}</span>
                          <span className="font-geist text-sm font-semibold text-white truncate max-w-xs sm:max-w-md">
                            {cert.title || 'Untitled Certificate'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            const copy = (content.certificatesList || []).filter((_, i) => i !== cIdx);
                            setContent(prev => ({ ...prev, certificatesList: copy }));
                            showToast('Certificate removed');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-mono text-xs hover:bg-rose-500/40 transition-colors"
                        >
                          Delete ✕
                        </button>
                      </div>

                      {/* Main Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="font-mono text-[11px] text-muted block mb-1">Judul Sertifikat (Title) *</label>
                          <input
                            type="text"
                            value={cert.title || ''}
                            onChange={(e) => {
                              const copy = [...content.certificatesList];
                              copy[cIdx] = { ...copy[cIdx], title: e.target.value };
                              setContent(prev => ({ ...prev, certificatesList: copy }));
                            }}
                            className="glass-input w-full px-3 py-2 rounded-lg text-xs text-white font-medium"
                            placeholder="e.g. Meta Front-End Developer Certificate"
                          />
                        </div>

                        <div>
                          <label className="font-mono text-[11px] text-muted block mb-1">Penerbit / Instansi (Issuer)</label>
                          <input
                            type="text"
                            value={cert.issuer || ''}
                            onChange={(e) => {
                              const copy = [...content.certificatesList];
                              copy[cIdx] = { ...copy[cIdx], issuer: e.target.value };
                              setContent(prev => ({ ...prev, certificatesList: copy }));
                            }}
                            className="glass-input w-full px-3 py-2 rounded-lg text-xs"
                            placeholder="e.g. Meta, Coursera, BINUS University"
                          />
                        </div>

                        <div>
                          <label className="font-mono text-[11px] text-muted block mb-1">Direct Link URL (Klik Direct ke Sini) *</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={cert.linkUrl || ''}
                              onChange={(e) => {
                                const copy = [...content.certificatesList];
                                copy[cIdx] = { ...copy[cIdx], linkUrl: e.target.value };
                                setContent(prev => ({ ...prev, certificatesList: copy }));
                              }}
                              className="glass-input flex-1 px-3 py-2 rounded-lg text-xs text-cyan-300 font-mono"
                              placeholder="https://..."
                            />
                            {cert.linkUrl && (
                              <a
                                href={cert.linkUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/40 text-xs font-mono shrink-0 transition-colors"
                                title="Test link"
                              >
                                Test ↗
                              </a>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="font-mono text-[11px] text-muted block mb-1">Ukuran / Rasio (Feed IG Style) *</label>
                          <select
                            value={cert.aspectRatio || 'aspect-[4/5]'}
                            onChange={(e) => {
                              const copy = [...content.certificatesList];
                              copy[cIdx] = { ...copy[cIdx], aspectRatio: e.target.value };
                              setContent(prev => ({ ...prev, certificatesList: copy }));
                            }}
                            className="glass-input w-full px-3 py-2 rounded-lg text-xs text-white"
                          >
                            <option value="aspect-[4/5]" className="bg-space-black text-white">Portrait (4:5 - IG Post Standar)</option>
                            <option value="aspect-square" className="bg-space-black text-white">Square (1:1 - Kotak Klasik)</option>
                            <option value="aspect-[16/10]" className="bg-space-black text-white">Landscape (16:10 - Sertifikat Melebar)</option>
                            <option value="aspect-[3/4]" className="bg-space-black text-white">Tall Portrait (3:4 - Vertikal Tinggi)</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-mono text-[11px] text-muted block mb-1">Badge Status / Kategori</label>
                          <input
                            type="text"
                            value={cert.badge || ''}
                            onChange={(e) => {
                              const copy = [...content.certificatesList];
                              copy[cIdx] = { ...copy[cIdx], badge: e.target.value };
                              setContent(prev => ({ ...prev, certificatesList: copy }));
                            }}
                            className="glass-input w-full px-3 py-2 rounded-lg text-xs"
                            placeholder="e.g. OFFICIAL CERTIFICATE"
                          />
                        </div>

                        <div>
                          <label className="font-mono text-[11px] text-muted block mb-1">Tahun / Tanggal (Year)</label>
                          <input
                            type="text"
                            value={cert.date || ''}
                            onChange={(e) => {
                              const copy = [...content.certificatesList];
                              copy[cIdx] = { ...copy[cIdx], date: e.target.value };
                              setContent(prev => ({ ...prev, certificatesList: copy }));
                            }}
                            className="glass-input w-full px-3 py-2 rounded-lg text-xs"
                            placeholder="2024"
                          />
                        </div>
                      </div>

                      {/* Photo Upload & Preview */}
                      <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        <div className="w-24 h-24 rounded-xl border border-white/20 bg-black/40 overflow-hidden flex items-center justify-center shrink-0">
                          {cert.imageUrl ? (
                            <img src={cert.imageUrl} alt={cert.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="font-mono text-[10px] text-muted text-center px-1">No Photo</span>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col gap-2 w-full">
                          <label className="font-mono text-[11px] text-muted">Foto Sertifikat (Upload atau URL)</label>
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="file"
                              id={`cert-img-${cIdx}`}
                              accept="image/*"
                              onChange={(e) => handleCertItemImageUpload(e.target.files[0], cIdx)}
                              className="hidden"
                            />
                            <label
                              htmlFor={`cert-img-${cIdx}`}
                              className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-xs cursor-pointer transition-colors border border-white/15"
                            >
                              📁 Upload File Foto
                            </label>
                            {cert.imageUrl && (
                              <button
                                type="button"
                                onClick={() => {
                                  const copy = [...content.certificatesList];
                                  copy[cIdx] = { ...copy[cIdx], imageUrl: '' };
                                  setContent(prev => ({ ...prev, certificatesList: copy }));
                                }}
                                className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 font-mono text-xs hover:bg-rose-500/30 transition-colors"
                              >
                                Hapus Foto
                              </button>
                            )}
                          </div>
                          <input
                            type="text"
                            value={cert.imageUrl || ''}
                            onChange={(e) => {
                              const copy = [...content.certificatesList];
                              copy[cIdx] = { ...copy[cIdx], imageUrl: e.target.value };
                              setContent(prev => ({ ...prev, certificatesList: copy }));
                            }}
                            className="glass-input w-full px-3 py-1.5 rounded-lg text-xs font-mono text-muted"
                            placeholder="Atau tempel URL gambar (https://...)"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 5: PROJECTS */}
            {activeTab === 'projects' && (
              <div className="glass-card rounded-2xl p-6 max-w-3xl mx-auto flex flex-col gap-6">
                <h2 className="font-geist text-lg font-semibold text-white border-b border-white/10 pb-2">
                  Featured Build & Terminal Spotlight
                </h2>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Project Name</label>
                    <input
                      type="text"
                      value={content.projectSpotlight.projectName}
                      onChange={(e) => updateField('projectSpotlight', 'projectName', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-semibold text-sm"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Status Badge</label>
                    <input
                      type="text"
                      value={content.projectSpotlight.badge}
                      onChange={(e) => updateField('projectSpotlight', 'badge', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">Project Description</label>
                  <textarea
                    rows="3"
                    value={content.projectSpotlight.description}
                    onChange={(e) => updateField('projectSpotlight', 'description', e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                  />
                </div>

                {/* Terminal Toggle & Window Chrome */}
                <div className="pt-4 border-t border-white/10">
                  <label className="font-mono text-xs text-muted uppercase block mb-3">Terminal Toggle &amp; Window Chrome</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted block mb-1">Toggle Text (Closed)</label>
                      <input
                        type="text"
                        value={content.projectSpotlight.toggleOpenLabel || ''}
                        onChange={(e) => updateField('projectSpotlight', 'toggleOpenLabel', e.target.value)}
                        placeholder="⚡ Open Logistics &amp; OCR Terminal"
                        className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted block mb-1">Toggle Text (Open)</label>
                      <input
                        type="text"
                        value={content.projectSpotlight.toggleCloseLabel || ''}
                        onChange={(e) => updateField('projectSpotlight', 'toggleCloseLabel', e.target.value)}
                        placeholder="Close Terminal Simulator"
                        className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted block mb-1">Deploy Status Label</label>
                      <input
                        type="text"
                        value={content.projectSpotlight.statusLabel || ''}
                        onChange={(e) => updateField('projectSpotlight', 'statusLabel', e.target.value)}
                        placeholder="ACTIVE DEPLOY"
                        className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted block mb-1">Terminal Window Path</label>
                      <input
                        type="text"
                        value={content.projectSpotlight.terminalPath || ''}
                        onChange={(e) => updateField('projectSpotlight', 'terminalPath', e.target.value)}
                        placeholder="~/theology26/smart-logistics-ocr"
                        className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="font-mono text-xs text-muted block mb-1">Terminal Window Badge (top-right)</label>
                      <input
                        type="text"
                        value={content.projectSpotlight.terminalBadge || ''}
                        onChange={(e) => updateField('projectSpotlight', 'terminalBadge', e.target.value)}
                        placeholder="BASH // LIVE"
                        className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>

                {/* CTA Button */}
                <div className="pt-4 border-t border-white/10">
                  <label className="font-mono text-xs text-muted uppercase block mb-3">Call-to-Action Button</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-mono text-xs text-muted block mb-1">Button Text</label>
                      <input
                        type="text"
                        value={content.projectSpotlight.ctaLabel || ''}
                        onChange={(e) => updateField('projectSpotlight', 'ctaLabel', e.target.value)}
                        placeholder="View Repository"
                        className="glass-input w-full px-3 py-2 rounded-lg font-geist text-xs font-semibold"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-xs text-muted block mb-1">Button Link (URL)</label>
                      <input
                        type="url"
                        value={content.projectSpotlight.ctaUrl || ''}
                        onChange={(e) => updateField('projectSpotlight', 'ctaUrl', e.target.value)}
                        placeholder="https://github.com/Theology26"
                        className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                      />
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-muted/60 mt-2">
                    Only http://, https:// or / paths are accepted — anything else falls back to the GitHub profile.
                  </p>
                </div>

                {/* Metrics Table */}
                <div>
                  <label className="font-mono text-xs text-muted block mb-2">Metrics Grid</label>
                  <div className="grid grid-cols-2 gap-3">
                    {content.projectSpotlight.metrics.map((m, i) => (
                      <div key={i} className="glass-pill p-3 rounded-xl flex items-center justify-between">
                        <input
                          type="text"
                          value={m.label}
                          onChange={(e) => {
                            const copy = [...content.projectSpotlight.metrics];
                            copy[i].label = e.target.value;
                            updateField('projectSpotlight', 'metrics', copy);
                          }}
                          className="glass-input px-2 py-1 rounded font-mono text-xs w-28 uppercase"
                        />
                        <input
                          type="text"
                          value={m.value}
                          onChange={(e) => {
                            const copy = [...content.projectSpotlight.metrics];
                            copy[i].value = e.target.value;
                            updateField('projectSpotlight', 'metrics', copy);
                          }}
                          className="glass-input px-2 py-1 rounded font-mono text-xs w-36 text-right text-cyan-400 font-bold"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Terminal Simulation Lines */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-mono text-xs text-muted uppercase">Terminal Simulation Commands</label>
                    <button
                      onClick={() => {
                        const copy = [...content.projectSpotlight.terminalLines, '$ echo "New command line"'];
                        updateField('projectSpotlight', 'terminalLines', copy);
                      }}
                      className="font-mono text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      + Add Command
                    </button>
                  </div>
                  <div className="flex flex-col gap-2">
                    {content.projectSpotlight.terminalLines.map((line, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted w-6">{idx + 1}.</span>
                        <input
                          type="text"
                          value={line}
                          onChange={(e) => {
                            const copy = [...content.projectSpotlight.terminalLines];
                            copy[idx] = e.target.value;
                            updateField('projectSpotlight', 'terminalLines', copy);
                          }}
                          className="glass-input flex-1 px-3 py-1.5 rounded-lg font-mono text-xs"
                        />
                        <button
                          onClick={() => {
                            const copy = content.projectSpotlight.terminalLines.filter((_, i) => i !== idx);
                            updateField('projectSpotlight', 'terminalLines', copy);
                          }}
                          className="text-rose-400 hover:text-rose-300 text-xs px-2"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* All Projects & Certificates Manager */}
                <div className="pt-6 border-t border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                    <div>
                      <h3 className="font-geist text-base font-semibold text-white flex items-center gap-2">
                        <span>Projects & Repositories Collection</span>
                        <span className="glass-pill px-2.5 py-0.5 rounded-full font-mono text-[10px] text-cyan-300">
                          {(content.projectsList || []).filter(p => p && p.showInPortfolio !== false).length} Aktif di Web
                        </span>
                        <span className="glass-pill px-2.5 py-0.5 rounded-full font-mono text-[10px] text-indigo-300">
                          {(content.projectsList || []).filter(p => p && p.type === 'project' && p.includeInCv === true).length} di CV
                        </span>
                        <span className="glass-pill px-2.5 py-0.5 rounded-full font-mono text-[10px] text-zinc-400">
                          {(content.projectsList || []).length} Total
                        </span>
                      </h3>
                      <p className="font-geist text-xs text-muted">
                        Manage project showcases and GitHub repositories.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleSyncGithub}
                        disabled={githubSyncing}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/20 border border-sky-400/40 text-sky-300 font-mono text-xs hover:bg-sky-500/35 transition-all flex items-center gap-1.5 disabled:opacity-50 shadow-[0_0_12px_rgba(56,189,248,0.15)]"
                        title="Fetch live repositories from GitHub directly into database"
                      >
                        <span>{githubSyncing ? '⟳ Syncing...' : '⚡ Pull from GitHub'}</span>
                      </button>
                      <button
                        onClick={() => {
                          const newProj = {
                            id: 'proj-' + Date.now(),
                            type: 'project',
                            title: 'New Project Title',
                            category: 'Web Development',
                            issuer: 'Client / Personal',
                            badge: 'NEW BUILD',
                            tags: 'Laravel, React, Tailwind',
                            description: 'Brief description of system architecture, technical challenge, and solution...',
                            linkUrl: 'https://github.com/Theology26',
                            imageUrl: '',
                            stats: 'Active',
                            date: '2025',
                            showInPortfolio: true,
                            includeInCv: false,
                            featured: false
                          };
                          const updated = [...(content.projectsList || []), newProj];
                          setContent(prev => ({ ...prev, projectsList: updated }));
                          showToast('+ New project added!');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-600/30 border border-cyan-500/40 text-cyan-200 font-mono text-xs hover:bg-cyan-600/50 transition-all flex items-center gap-1.5"
                      >
                        <span>+ Add Project</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-5">
                    {(content.projectsList || []).map((proj, pIdx) => {
                      const isCert = proj.type === 'certificate';
                      const isHidden = proj.showInPortfolio === false;
                      return (
                        <div key={proj.id || pIdx} className={`glass-pill p-5 rounded-2xl flex flex-col gap-4 border ${
                          isHidden
                            ? 'border-zinc-700/60 bg-black/50 opacity-80'
                            : isCert
                            ? 'border-emerald-500/30 bg-emerald-950/10'
                            : 'border-cyan-500/30 bg-cyan-950/10'
                        }`}>
                          {/* Card Header: Item Number, Type Selector, Title, and Delete */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-muted w-6">#{pIdx + 1}</span>
                              <select
                                value={proj.type || 'project'}
                                onChange={(e) => {
                                  const copy = [...content.projectsList];
                                  copy[pIdx].type = e.target.value;
                                  setContent(prev => ({ ...prev, projectsList: copy }));
                                }}
                                className="glass-input px-2.5 py-1 rounded-lg font-mono text-xs font-semibold text-white bg-black/60 border border-white/20"
                              >
                                <option value="project" className="bg-slate-900 text-cyan-300">📁 PROJECT</option>
                                <option value="certificate" className="bg-slate-900 text-emerald-300">📜 CERTIFICATE</option>
                              </select>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold tracking-wider ${
                                isCert ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              }`}>
                                {isCert ? 'CERTIFICATE' : 'PROJECT'}
                              </span>
                              {isHidden ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40" title="Project ini disembunyikan dari web & PDF">
                                  🙈 HIDDEN DARI WEB
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                  🌐 WEB ACTIVE
                                </span>
                              )}
                              {!isCert && proj.includeInCv === true && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                                  📄 CV ACTIVE
                                </span>
                              )}
                              {proj.featured === true && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                                  ★ FEATURED
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                if (confirm(`Delete "${proj.title}"?`)) {
                                  const copy = content.projectsList.filter((_, i) => i !== pIdx);
                                  setContent(prev => ({ ...prev, projectsList: copy }));
                                  showToast('Item deleted successfully');
                                }
                              }}
                              className="text-rose-400 hover:text-rose-300 font-mono text-xs px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 transition-colors"
                            >
                              Delete ✕
                            </button>
                          </div>

                          {/* Image Upload & Direct Link Section */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-3.5 rounded-xl bg-black/40 border border-white/[0.08]">
                            {/* Image Preview & Upload */}
                            <div className="md:col-span-5 flex flex-col gap-2">
                              <label className="font-mono text-[10px] text-muted uppercase flex items-center justify-between">
                                <span>Image / Scan Document</span>
                                {proj.imageUrl && (
                                  <button
                                    onClick={() => {
                                      const copy = [...content.projectsList];
                                      copy[pIdx].imageUrl = '';
                                      setContent(prev => ({ ...prev, projectsList: copy }));
                                      showToast('Image removed');
                                    }}
                                    className="text-rose-400 hover:underline text-[10px]"
                                  >
                                    Remove Image
                                  </button>
                                )}
                              </label>

                              {proj.imageUrl ? (
                                <div className="relative group rounded-xl overflow-hidden border border-white/20 h-32 bg-black/50">
                                  <img
                                    src={proj.imageUrl}
                                    alt={proj.title}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <label className="cursor-pointer px-3 py-1 rounded-lg bg-white/20 text-white font-mono text-xs hover:bg-white/30 backdrop-blur-sm">
                                      Change Image
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => handleProjectItemImageUpload(e.target.files[0], pIdx)}
                                      />
                                    </label>
                                  </div>
                                </div>
                              ) : (
                                <label className="h-32 border-2 border-dashed border-white/20 hover:border-cyan-400/60 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-white/[0.02] hover:bg-white/[0.04]">
                                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40 mb-1">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                    <circle cx="8.5" cy="8.5" r="1.5"/>
                                    <polyline points="21 15 16 10 5 21"/>
                                  </svg>
                                  <span className="font-mono text-xs text-white/80">Upload Image File</span>
                                  <span className="font-mono text-[9px] text-muted">PNG, JPG, WebP max 5MB</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleProjectItemImageUpload(e.target.files[0], pIdx)}
                                  />
                                </label>
                              )}

                              {/* Or paste direct Image URL */}
                              <input
                                type="text"
                                value={proj.imageUrl || ''}
                                placeholder="Or paste direct Image URL..."
                                onChange={(e) => {
                                  const copy = [...content.projectsList];
                                  copy[pIdx].imageUrl = e.target.value;
                                  setContent(prev => ({ ...prev, projectsList: copy }));
                                }}
                                className="glass-input w-full px-2.5 py-1 rounded-lg text-xs font-mono"
                              />
                            </div>

                            {/* Direct Link & Destination */}
                            <div className="md:col-span-7 flex flex-col justify-between gap-3">
                              <div>
                                <label className="font-mono text-[10px] text-cyan-300 uppercase block mb-1">
                                  🔗 Direct Link URL (Tujuan Klik)
                                </label>
                                <input
                                  type="text"
                                  value={proj.linkUrl || ''}
                                  placeholder="https://credential.net/verify/... atau https://github.com/..."
                                  onChange={(e) => {
                                    const copy = [...content.projectsList];
                                    copy[pIdx].linkUrl = e.target.value;
                                    setContent(prev => ({ ...prev, projectsList: copy }));
                                  }}
                                  className="glass-input w-full px-3 py-2 rounded-lg text-xs font-mono text-cyan-200 border-cyan-500/40"
                                />
                                <div className="flex items-center justify-between mt-1.5">
                                  <span className="font-mono text-[10px] text-muted">
                                    Link ini akan dibuka saat kartu atau tombol diklik di web.
                                  </span>
                                  {proj.linkUrl && (
                                    <a
                                      href={proj.linkUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="font-mono text-[10px] text-cyan-400 hover:text-cyan-200 flex items-center gap-1"
                                    >
                                      <span>Test Buka Link</span>
                                      <span>↗</span>
                                    </a>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="font-mono text-[10px] text-muted block mb-1">Penerbit / Organisasi (Issuer)</label>
                                  <input
                                    type="text"
                                    value={proj.issuer || ''}
                                    placeholder="e.g. BINUS, Meta, Laravel"
                                    onChange={(e) => {
                                      const copy = [...content.projectsList];
                                      copy[pIdx].issuer = e.target.value;
                                      setContent(prev => ({ ...prev, projectsList: copy }));
                                    }}
                                    className="glass-input w-full px-2.5 py-1.5 rounded-lg text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="font-mono text-[10px] text-muted block mb-1">Tahun / Periode</label>
                                  <input
                                    type="text"
                                    value={proj.date || ''}
                                    placeholder="e.g. 2024, 2025"
                                    onChange={(e) => {
                                      const copy = [...content.projectsList];
                                      copy[pIdx].date = e.target.value;
                                      setContent(prev => ({ ...prev, projectsList: copy }));
                                    }}
                                    className="glass-input w-full px-2.5 py-1.5 rounded-lg text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Title and Badge fields */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-2">
                              <label className="font-mono text-[10px] text-muted block mb-1">Title / Full Name</label>
                              <input
                                type="text"
                                value={proj.title || ''}
                                placeholder="Project Title or Certification Name"
                                onChange={(e) => {
                                  const copy = [...content.projectsList];
                                  copy[pIdx].title = e.target.value;
                                  setContent(prev => ({ ...prev, projectsList: copy }));
                                }}
                                className="glass-input w-full px-3 py-1.5 rounded-lg font-semibold text-sm text-white"
                              />
                            </div>
                            <div>
                              <label className="font-mono text-[10px] text-muted block mb-1">Badge Text</label>
                              <input
                                type="text"
                                value={proj.badge || ''}
                                placeholder="OFFICIAL CERTIFICATE / ACTIVE PROJECT"
                                onChange={(e) => {
                                  const copy = [...content.projectsList];
                                  copy[pIdx].badge = e.target.value;
                                  setContent(prev => ({ ...prev, projectsList: copy }));
                                }}
                                className="glass-input w-full px-3 py-1.5 rounded-lg text-xs font-mono uppercase"
                              />
                            </div>
                          </div>

                          {/* Category and Tags */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <label className="font-mono text-[10px] text-muted block mb-1">Category</label>
                              <input
                                type="text"
                                value={proj.category || ''}
                                placeholder="e.g. Backend Architecture, AI"
                                onChange={(e) => {
                                  const copy = [...content.projectsList];
                                  copy[pIdx].category = e.target.value;
                                  setContent(prev => ({ ...prev, projectsList: copy }));
                                }}
                                className="glass-input w-full px-2.5 py-1.5 rounded-lg text-xs"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="font-mono text-[10px] text-muted block mb-1">Tech Tags (comma separated)</label>
                              <input
                                type="text"
                                value={proj.tags || ''}
                                placeholder="Laravel 11, PHP 8.3, TDD"
                                onChange={(e) => {
                                  const copy = [...content.projectsList];
                                  copy[pIdx].tags = e.target.value;
                                  setContent(prev => ({ ...prev, projectsList: copy }));
                                }}
                                className="glass-input w-full px-2.5 py-1.5 rounded-lg text-xs"
                              />
                            </div>
                          </div>

                          {/* Visibility & Placement Controls (Web Portfolio, CV ATS, Featured) */}
                          <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.08] flex flex-col gap-3">
                            <div className="font-mono text-[10px] text-muted uppercase tracking-wider">
                              Visibility &amp; Placement Controls
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* 1. Show in Portfolio / Dashboard */}
                              <label className="flex items-start gap-2.5 cursor-pointer select-none p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                                <input
                                  type="checkbox"
                                  checked={proj.showInPortfolio !== false}
                                  onChange={(e) => {
                                    const copy = [...content.projectsList];
                                    copy[pIdx].showInPortfolio = e.target.checked;
                                    setContent(prev => ({ ...prev, projectsList: copy }));
                                  }}
                                  className="w-4 h-4 mt-0.5 accent-cyan-400 rounded"
                                />
                                <div>
                                  <span className="font-geist text-xs text-white font-medium block">Web Portfolio</span>
                                  <span className="font-mono text-[10px] text-muted block leading-tight">
                                    {proj.showInPortfolio !== false ? '✓ Tampil di landing page & PDF' : '✕ Disembunyikan (backup/arsip)'}
                                  </span>
                                </div>
                              </label>

                              {/* 2. Show in CV (Only for projects, not certs) */}
                              {!isCert ? (
                                <label className="flex items-start gap-2.5 cursor-pointer select-none p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={proj.includeInCv === true}
                                    onChange={(e) => {
                                      const copy = [...content.projectsList];
                                      copy[pIdx].includeInCv = e.target.checked;
                                      setContent(prev => ({ ...prev, projectsList: copy }));
                                    }}
                                    className="w-4 h-4 mt-0.5 accent-cyan-400 rounded"
                                  />
                                  <div>
                                    <span className="font-geist text-xs text-white font-medium block">Selected for CV</span>
                                    <span className="font-mono text-[10px] text-muted block leading-tight">
                                      {proj.includeInCv === true ? '✓ Dicetak di lembar ATS CV' : '✕ Tidak masuk ATS CV'}
                                    </span>
                                  </div>
                                </label>
                              ) : (
                                <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] opacity-50">
                                  <span className="font-geist text-xs text-muted block">CV Document</span>
                                  <span className="font-mono text-[10px] text-muted block">Sertifikat diatur di tab CV</span>
                                </div>
                              )}

                              {/* 3. Featured Spotlight */}
                              <label className="flex items-start gap-2.5 cursor-pointer select-none p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.05] transition-colors">
                                <input
                                  type="checkbox"
                                  checked={proj.featured === true}
                                  onChange={(e) => {
                                    const copy = [...content.projectsList];
                                    copy[pIdx].featured = e.target.checked;
                                    setContent(prev => ({ ...prev, projectsList: copy }));
                                  }}
                                  className="w-4 h-4 mt-0.5 accent-yellow-400 rounded"
                                />
                                <div>
                                  <span className="font-geist text-xs text-white font-medium block">Featured Star</span>
                                  <span className="font-mono text-[10px] text-muted block leading-tight">
                                    {proj.featured === true ? '★ Sorotan utama / prioritas' : 'Standar'}
                                  </span>
                                </div>
                              </label>
                            </div>

                            {/* CV-only overrides */}
                            {!isCert && proj.includeInCv === true && (
                              <div className="flex flex-col gap-2 pt-2.5 border-t border-white/[0.08]">
                                <span className="font-mono text-[10px] text-amber-300/80 uppercase">
                                  CV-only overrides — kosongkan jika ingin menggunakan judul &amp; deskripsi di atas
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={proj.cvTitle || ''}
                                    placeholder={`CV title (default: ${proj.title || '—'})`}
                                    onChange={(e) => {
                                      const copy = [...content.projectsList];
                                      copy[pIdx].cvTitle = e.target.value;
                                      setContent(prev => ({ ...prev, projectsList: copy }));
                                    }}
                                    className="glass-input w-full px-2.5 py-1.5 rounded-lg text-xs"
                                  />
                                  <input
                                    type="text"
                                    value={proj.cvDate || ''}
                                    placeholder={`CV date (default: ${proj.date || '—'})`}
                                    onChange={(e) => {
                                      const copy = [...content.projectsList];
                                      copy[pIdx].cvDate = e.target.value;
                                      setContent(prev => ({ ...prev, projectsList: copy }));
                                    }}
                                    className="glass-input w-full px-2.5 py-1.5 rounded-lg text-xs font-mono"
                                  />
                                </div>
                                <textarea
                                  rows="2"
                                  value={proj.cvDescription || ''}
                                  placeholder="CV-only description (kosongkan untuk menggunakan deskripsi di atas)"
                                  onChange={(e) => {
                                    const copy = [...content.projectsList];
                                    copy[pIdx].cvDescription = e.target.value;
                                    setContent(prev => ({ ...prev, projectsList: copy }));
                                  }}
                                  className="glass-input w-full px-2.5 py-1.5 rounded-lg text-xs"
                                />
                              </div>
                            )}
                          </div>

                          {/* Description */}
                          <div>
                            <label className="font-mono text-[10px] text-muted block mb-1">Detailed Description</label>
                            <textarea
                              rows="2"
                              value={proj.description || ''}
                              placeholder="Description of project architecture, key features, or certificate curriculum..."
                              onChange={(e) => {
                                const copy = [...content.projectsList];
                                copy[pIdx].description = e.target.value;
                                setContent(prev => ({ ...prev, projectsList: copy }));
                              }}
                              className="glass-input w-full px-3 py-1.5 rounded-lg text-xs"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: ATS CV GENERATOR */}
            {activeTab === 'cv' && (
              <div className="glass-card rounded-2xl p-6 max-w-3xl mx-auto flex flex-col gap-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <h2 className="font-geist text-lg font-semibold text-white">
                      ATS CV & PDF Generator Configuration
                    </h2>
                    <p className="font-geist text-xs text-muted">
                      Exact A4 Portrait (210 × 297 mm) architecture template. Supports photo display and instant browser print/download.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <a
                      href="/api/portfolio/pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl bg-white text-space-black font-geist text-xs font-bold hover:bg-zinc-200 transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      Portfolio PDF (A4, 3 pages) ↗
                    </a>
                    <a
                      href="/api/cv/download?format=html"
                      target="_blank"
                      className="px-4 py-2 rounded-xl bg-cyan-500 text-space-black font-geist text-xs font-bold hover:bg-cyan-400 transition-all shadow-md flex items-center gap-1.5"
                    >
                      Preview & Print A4 CV ↗
                    </a>
                  </div>
                </div>

                {/* Profile Photo Display Toggle on CV */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-cyan-400/50 bg-black/40 flex items-center justify-center shrink-0">
                      {content.cvData?.avatarUrl || content.lanyard?.avatarUrl ? (
                        <img
                          src={content.cvData?.avatarUrl || content.lanyard?.avatarUrl}
                          alt="CV Photo"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-mono text-xs text-muted">No Photo</span>
                      )}
                    </div>
                    <div>
                      <span className="font-geist text-sm text-white font-medium block">Display Profile Photo on CV Document</span>
                      <span className="font-mono text-[11px] text-muted">Show official portrait avatar at the top header of the A4 CV sheet</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={content.cvData?.showPhoto !== false}
                      onChange={(e) => updateField('cvData', 'showPhoto', e.target.checked)}
                      className="w-4 h-4 accent-cyan-400 rounded"
                    />
                    <span className="font-mono text-xs text-cyan-300">Show Photo</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Full Legal Name (for CV)</label>
                    <input
                      type="text"
                      value={content.cvData.fullName}
                      onChange={(e) => updateField('cvData', 'fullName', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-bold text-sm"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Professional Job Title</label>
                    <input
                      type="text"
                      value={content.cvData.jobTitle}
                      onChange={(e) => updateField('cvData', 'jobTitle', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Email</label>
                    <input
                      type="email"
                      value={content.cvData.email}
                      onChange={(e) => updateField('cvData', 'email', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Location / Address</label>
                    <input
                      type="text"
                      value={content.cvData.location}
                      onChange={(e) => updateField('cvData', 'location', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">LinkedIn Profile</label>
                    <input
                      type="text"
                      value={content.cvData.linkedin}
                      onChange={(e) => updateField('cvData', 'linkedin', e.target.value)}
                      className="glass-input w-full px-3 py-2 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">Professional Summary</label>
                  <textarea
                    rows="3"
                    value={content.cvData.summary}
                    onChange={(e) => updateField('cvData', 'summary', e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-lg text-sm leading-relaxed"
                  />
                </div>

                {/* Experience list */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-mono text-xs text-muted uppercase">Experience Items</label>
                    <button
                      onClick={() => {
                        const copy = [
                          ...content.cvData.experiences,
                          { title: 'New Role', company: 'Company Name', year: '2024', description: 'Role duties...' },
                        ];
                        updateField('cvData', 'experiences', copy);
                      }}
                      className="font-mono text-xs text-cyan-400 hover:text-cyan-300"
                    >
                      + Add Experience
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {content.cvData.experiences.map((exp, idx) => (
                      <div key={idx} className="glass-pill p-4 rounded-xl flex flex-col gap-2 relative">
                        <button
                          onClick={() => {
                            const copy = content.cvData.experiences.filter((_, i) => i !== idx);
                            updateField('cvData', 'experiences', copy);
                          }}
                          className="absolute top-3 right-3 text-rose-400 text-sm font-bold"
                          title="Remove item"
                        >
                          ×
                        </button>
                        <div className="grid grid-cols-3 gap-2 pr-6">
                          <input
                            type="text"
                            placeholder="Title / Role"
                            value={exp.title}
                            onChange={(e) => {
                              const copy = [...content.cvData.experiences];
                              copy[idx].title = e.target.value;
                              updateField('cvData', 'experiences', copy);
                            }}
                            className="glass-input px-3 py-1.5 rounded-lg text-xs font-bold"
                          />
                          <input
                            type="text"
                            placeholder="Company / Institution"
                            value={exp.company}
                            onChange={(e) => {
                              const copy = [...content.cvData.experiences];
                              copy[idx].company = e.target.value;
                              updateField('cvData', 'experiences', copy);
                            }}
                            className="glass-input px-3 py-1.5 rounded-lg text-xs"
                          />
                          <input
                            type="text"
                            placeholder="Year (e.g., 2022 — 2024)"
                            value={exp.year}
                            onChange={(e) => {
                              const copy = [...content.cvData.experiences];
                              copy[idx].year = e.target.value;
                              updateField('cvData', 'experiences', copy);
                            }}
                            className="glass-input px-3 py-1.5 rounded-lg text-xs font-mono"
                          />
                        </div>
                        <textarea
                          rows="2"
                          placeholder="Description of accomplishments..."
                          value={exp.description}
                          onChange={(e) => {
                            const copy = [...content.cvData.experiences];
                            copy[idx].description = e.target.value;
                            updateField('cvData', 'experiences', copy);
                          }}
                          className="glass-input w-full px-3 py-1.5 rounded-lg text-xs"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Read-only summary — selection itself lives in the Projects tab */}
                <div className="pt-4 border-t border-white/10">
                  {(() => {
                    const onCv = (content.projectsList || []).filter((p) => p && p.type === 'project' && p.includeInCv);
                    return (
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                          <label className="font-mono text-xs text-muted uppercase">Projects on this CV</label>
                          <span className="glass-pill px-2.5 py-0.5 rounded-full font-mono text-[10px] text-cyan-300">
                            {onCv.length} selected
                          </span>
                        </div>
                        {onCv.length === 0 ? (
                          <p className="font-mono text-[11px] text-muted/70 text-center py-4 border border-dashed border-white/10 rounded-xl">
                            No projects on the CV. Tick &quot;Selected for CV&quot; on a project in the Projects tab.
                          </p>
                        ) : (
                          <ol className="flex flex-col gap-1.5">
                            {onCv.map((p, i) => (
                              <li key={p.id || `${p.title}-${i}`} className="glass-pill px-3 py-2 rounded-lg flex items-baseline gap-2">
                                <span className="font-mono text-[10px] text-cyan-400">{i + 1}.</span>
                                <span className="font-geist text-xs text-white truncate">{p.title}</span>
                                {p.cvTitle && (
                                  <span className="font-mono text-[10px] text-amber-300/80 shrink-0" title="CV-only title override">
                                    prints as: {p.cvTitle}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}
                        <p className="font-mono text-[10px] text-muted/60 mt-2">
                          GitHub sync never adds or removes CV projects — it only refreshes stars, tags and language stats.
                        </p>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">Technical Skills String</label>
                  <input
                    type="text"
                    value={content.cvData.technicalSkills}
                    onChange={(e) => updateField('cvData', 'technicalSkills', e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {/* TAB 6: GITHUB API ENGINE */}
            {activeTab === 'github' && (
              <div className="glass-card rounded-2xl p-6 max-w-2xl mx-auto flex flex-col gap-5">
                <div className="border-b border-white/10 pb-3">
                  <h2 className="font-geist text-lg font-semibold text-white">
                    GitHub Telemetry & API Integration
                  </h2>
                  <p className="font-geist text-xs text-muted">
                    Synchronize real-time repositories, stars, forks, and language analytics directly from GitHub API.
                  </p>
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">GitHub Username</label>
                  <input
                    type="text"
                    value={content.general.githubUsername}
                    onChange={(e) => updateField('general', 'githubUsername', e.target.value)}
                    className="glass-input w-full px-4 py-2.5 rounded-xl font-mono text-sm"
                    placeholder="Theology26"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">
                    GitHub Personal Access Token (PAT)
                  </label>
                  <input
                    type="password"
                    value={content.general.githubToken}
                    onChange={(e) => updateField('general', 'githubToken', e.target.value)}
                    className="glass-input w-full px-4 py-2.5 rounded-xl font-mono text-sm"
                    placeholder="paste_your_github_token_here (Optional for public repos — only raises the rate limit)"
                  />
                  <span className="font-mono text-[11px] text-muted/80 mt-1.5 block">
                    Token is securely stored locally in your SQLite database. Grants access to private/public repo statistics.
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSyncGithub}
                    disabled={githubSyncing}
                    className="w-full py-3 rounded-xl bg-cyan-500 text-space-black font-geist text-sm font-bold hover:bg-cyan-400 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {githubSyncing ? (
                      <>
                        <span className="animate-spin">⟳</span> Connecting to GitHub API...
                      </>
                    ) : (
                      <>
                        <span>⚡</span> Synchronize Repositories Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB 7: SPACE 3D SETTINGS */}
            {activeTab === 'space' && (
              <div className="glass-card rounded-2xl p-6 max-w-2xl mx-auto flex flex-col gap-5">
                <div className="border-b border-white/10 pb-3">
                  <h2 className="font-geist text-lg font-semibold text-white">
                    WebGL Deep Space Simulation Parameters
                  </h2>
                  <p className="font-geist text-xs text-muted">
                    Tune star density, nebula clouds drift, and satellite orbital dynamics.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Total Stars Count</label>
                    <input
                      type="number"
                      value={content.spaceConfig.starsCount}
                      onChange={(e) => updateField('spaceConfig', 'starsCount', parseInt(e.target.value) || 3200)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted block mb-1">Nebula Clouds Count</label>
                    <input
                      type="number"
                      value={content.spaceConfig.nebulaCount}
                      onChange={(e) => updateField('spaceConfig', 'nebulaCount', parseInt(e.target.value) || 75)}
                      className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">
                    Satellite Orbit Speed Multiplier ({content.spaceConfig.orbitSpeedMultiplier}x)
                  </label>
                  <input
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={content.spaceConfig.orbitSpeedMultiplier}
                    onChange={(e) => updateField('spaceConfig', 'orbitSpeedMultiplier', parseFloat(e.target.value) || 1.0)}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">
                    Atmospheric Scattering Glow Intensity ({content.spaceConfig.atmosphereIntensity}x)
                  </label>
                  <input
                    type="range"
                    min="0.3"
                    max="2.5"
                    step="0.1"
                    value={content.spaceConfig.atmosphereIntensity}
                    onChange={(e) => updateField('spaceConfig', 'atmosphereIntensity', parseFloat(e.target.value) || 1.0)}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <label className="font-mono text-xs text-muted block mb-1">Master Security Passcode</label>
                  <input
                    type="text"
                    value={content.general.adminPasscode}
                    onChange={(e) => updateField('general', 'adminPasscode', e.target.value)}
                    className="glass-input w-full px-3 py-2 rounded-lg font-mono text-xs text-emerald-400 font-bold"
                  />
                  <span className="font-mono text-[10px] text-muted mt-1 block">
                    Key required to log into this Admin Console.
                  </span>
                </div>
              </div>
            )}
          </main>
        </div>
      );
    };

    ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp />);
  
