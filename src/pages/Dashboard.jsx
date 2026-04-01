import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { getChannels, addChannel, editChannel, removeChannel, getProfiles, editProfile, onChannelsChange } from '../lib/db'
import toast from 'react-hot-toast'

const STATUSES = [
  { key: 'production', label: 'Production', color: '#da373c', bg: 'rgba(218,55,60,.15)' },
  { key: 'waiting', label: 'Waiting to Upload', color: '#f0b232', bg: 'rgba(240,178,50,.15)' },
  { key: 'uploaded', label: 'Uploaded', color: '#23a559', bg: 'rgba(35,165,89,.15)' },
]
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]))
const DEFAULT_CATS = [{ id: 'info', name: 'Channel Information', type: 'info' }]
const uid = () => Math.random().toString(36).slice(2, 8)
const DAYS_HEADER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const dateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const Pill = ({ children, color, bg }) => <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 5, background: bg, color }}>{children}</span>
const YTLogo = ({ size = 18 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}><rect x="2" y="4" width="20" height="16" rx="4" fill="#FF0000"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="#fff"/></svg>
const Arrow = ({ open }) => <span style={{ fontSize: 10, display: 'inline-block', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', color: 'var(--text-dim)', marginRight: 2, transition: 'transform .12s' }}>▶</span>

function getCalendarDays(year, month) {
  const lastDay = new Date(year, month + 1, 0)
  let startDay = new Date(year, month, 1).getDay() - 1; if (startDay < 0) startDay = 6
  const cells = []; for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d)
  return cells
}

function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef()
  useEffect(() => { const h = e => { if (ref.current && !ref.current.contains(e.target)) onClose() }; document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h) }, [onClose])
  return <div ref={ref} style={{ position: 'fixed', left: x, top: y, zIndex: 9999, background: '#111214', border: '1px solid var(--border-hi)', borderRadius: 8, padding: '4px 0', minWidth: 190, boxShadow: '0 8px 24px rgba(0,0,0,.6)' }}>
    {items.map((item, i) => item.divider ? <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 8px' }} /> : <div key={i} onClick={() => { item.action(); onClose() }} style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 14, color: item.danger ? 'var(--red)' : '#fff' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(88,101,242,.15)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>{item.label}</div>)}
  </div>
}

function NicknamePrompt({ onSave }) {
  const [name, setName] = useState(''); const ref = useRef(); useEffect(() => ref.current?.focus(), [])
  return <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 400, maxWidth: '90vw', background: '#1e1f22', border: '1px solid var(--border)', borderRadius: 12, padding: 28, textAlign: 'center' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6, color: '#fff' }}>Welcome to TubeFlow!</h2>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 20 }}>What should we call you?</p>
      <input ref={ref} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()) }} placeholder="Your nickname..." style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--accent)', background: 'var(--input)', color: '#fff', fontSize: 18, outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
      <button onClick={() => { if (name.trim()) onSave(name.trim()) }} style={{ width: '100%', marginTop: 14, padding: 13, background: 'var(--accent)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Set Nickname</button>
    </div>
  </div>
}

// ─── YouTube Day Panel (date-based) ────────────────────────────────────────────
function DayPanel({ dateKey: dk, dayNum, data, onSave, onClose, fontSize }) {
  const [f, setF] = useState(data || {})
  const timer = useRef(null)
  useEffect(() => { setF(data || {}) }, [dk])
  const u = (k, v) => { const next = { ...f, [k]: v }; setF(next); clearTimeout(timer.current); timer.current = setTimeout(() => onSave(dk, next), 300) }
  const inp = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input)', color: '#fff', fontSize, outline: 'none', boxSizing: 'border-box' }
  const lbl = { fontSize: fontSize * 0.8, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, display: 'block' }
  return (
    <div className="slide-in" style={{ position: 'fixed', top: 0, right: 0, width: 'min(580px,96vw)', height: '100vh', background: '#2b2d31', borderLeft: '1px solid var(--border)', zIndex: 1000, display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 40px rgba(0,0,0,.55)' }}>
      <div style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: 'rgba(88,101,242,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{dayNum}</div>
          <span style={{ fontWeight: 700, fontSize: fontSize + 4, color: '#fff' }}>{dk}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 24, cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div><label style={lbl}>Status</label><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUSES.map(st => { const on = f.status === st.key; return <button key={st.key} onClick={() => u('status', on ? '' : st.key)} style={{ padding: '10px 18px', borderRadius: 8, cursor: 'pointer', fontSize, fontWeight: 600, background: on ? st.bg : 'var(--input)', border: `2px solid ${on ? st.color : 'var(--border)'}`, color: on ? st.color : 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 8, transition: 'none' }}><div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${on ? st.color : 'var(--border)'}`, background: on ? st.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on && <span style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>✓</span>}</div>{st.label}</button> })}
        </div></div>
        <div><label style={lbl}>Title</label><input value={f.title || ''} onChange={e => u('title', e.target.value)} placeholder="Video title..." style={{ ...inp, fontSize: fontSize + 2, fontWeight: 600 }} /></div>
        <div><label style={lbl}>Master Prompt</label><textarea value={f.master_prompt || ''} onChange={e => u('master_prompt', e.target.value)} placeholder="Paste master prompt..." rows={5} style={{ ...inp, resize: 'vertical', lineHeight: 1.55 }} /></div>
        <div><label style={lbl}>Script</label><textarea value={f.script_text || ''} onChange={e => u('script_text', e.target.value)} placeholder="Paste or type script..." rows={8} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} /></div>
        <div><label style={lbl}>Video Location URL</label><input value={f.video_url || ''} onChange={e => u('video_url', e.target.value)} placeholder="Google Drive, Dropbox link..." style={inp} />{f.video_url && <a href={f.video_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 6, fontSize: fontSize - 1, color: 'var(--accent)', textDecoration: 'none' }}>Open link →</a>}</div>
      </div>
    </div>
  )
}

// ─── Shared Day Panel (Our Schedule) ───────────────────────────────────────────
function SharedDayPanel({ dateKey: dk, dayNum, data, onSave, onClose, fontSize }) {
  const [leo, setLeo] = useState(data?.leo || false)
  const [olivka, setOlivka] = useState(data?.olivka || false)
  const [note, setNote] = useState(data?.note || '')
  const timer = useRef(null)
  useEffect(() => { setLeo(data?.leo || false); setOlivka(data?.olivka || false); setNote(data?.note || '') }, [dk])
  const save = (l, o, n) => { clearTimeout(timer.current); timer.current = setTimeout(() => onSave(dk, { leo: l, olivka: o, note: n }), 200) }
  const toggleLeo = () => { const v = !leo; setLeo(v); save(v, olivka, note) }
  const toggleOlivka = () => { const v = !olivka; setOlivka(v); save(leo, v, note) }
  const updateNote = n => { setNote(n); save(leo, olivka, n) }
  const inp = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input)', color: '#fff', fontSize, outline: 'none', boxSizing: 'border-box' }
  const lbl = { fontSize: fontSize * 0.8, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6, display: 'block' }
  return (
    <div className="slide-in" style={{ position: 'fixed', top: 0, right: 0, width: 'min(580px,96vw)', height: '100vh', background: '#2b2d31', borderLeft: '1px solid var(--border)', zIndex: 1000, display: 'flex', flexDirection: 'column', boxShadow: '-6px 0 40px rgba(0,0,0,.55)' }}>
      <div style={{ padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', background: 'rgba(245,169,208,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg, #5bcefa, #f5a9d0)', color: '#fff', fontWeight: 700, fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{dayNum}</div>
          <span style={{ fontWeight: 700, fontSize: fontSize + 4, color: '#fff' }}>{dk}</span>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 24, cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div><label style={lbl}>Work</label><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={toggleLeo} style={{ padding: '14px 28px', borderRadius: 10, cursor: 'pointer', fontSize: fontSize + 1, fontWeight: 700, background: leo ? 'rgba(91,206,250,.15)' : 'var(--input)', border: `3px solid ${leo ? '#5bcefa' : 'var(--border)'}`, color: leo ? '#5bcefa' : 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 10, transition: 'none' }}><div style={{ width: 24, height: 24, borderRadius: 6, border: `3px solid ${leo ? '#5bcefa' : 'var(--border)'}`, background: leo ? '#5bcefa' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{leo && <span style={{ color: '#111', fontSize: 14, fontWeight: 700 }}>✓</span>}</div>Leo</button>
          <button onClick={toggleOlivka} style={{ padding: '14px 28px', borderRadius: 10, cursor: 'pointer', fontSize: fontSize + 1, fontWeight: 700, background: olivka ? 'rgba(245,169,208,.15)' : 'var(--input)', border: `3px solid ${olivka ? '#f5a9d0' : 'var(--border)'}`, color: olivka ? '#f5a9d0' : 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: 10, transition: 'none' }}><div style={{ width: 24, height: 24, borderRadius: 6, border: `3px solid ${olivka ? '#f5a9d0' : 'var(--border)'}`, background: olivka ? '#f5a9d0' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{olivka && <span style={{ color: '#111', fontSize: 14, fontWeight: 700 }}>✓</span>}</div>Olivka</button>
        </div></div>
        <div><label style={lbl}>Notes</label><textarea value={note} onChange={e => updateNote(e.target.value)} placeholder="Any notes for this day..." rows={4} style={{ ...inp, resize: 'vertical', lineHeight: 1.6 }} /></div>
      </div>
    </div>
  )
}

// ─── Shared Tasks (Our Schedule → Tasks) ───────────────────────────────────────
function SharedTasksView({ taskData, onSave, fontSize }) {
  // taskData can be an array (legacy) or { items: [], folders: [] }
  const legacy = Array.isArray(taskData)
  const [items, setItems] = useState(legacy ? taskData : (taskData?.items || []))
  const [folders, setFolders] = useState(legacy ? [] : (taskData?.folders || []))
  const [activeFolder, setActiveFolder] = useState('all')
  const [newText, setNewText] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [folderMenu, setFolderMenu] = useState(null)
  const [renamingFolder, setRenamingFolder] = useState(null)
  const [folderRenameText, setFolderRenameText] = useState('')
  const newRef = useRef()
  const folderRenameRef = useRef()
  const newFolderRef = useRef()

  // Auto-size textarea on mount
  const autoSize = el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }

  useEffect(() => {
    const l = Array.isArray(taskData)
    setItems(l ? taskData : (taskData?.items || []))
    setFolders(l ? [] : (taskData?.folders || []))
  }, [JSON.stringify(taskData)])

  // Auto-resize all textareas when items change
  useEffect(() => {
    setTimeout(() => {
      document.querySelectorAll('[data-autosize]').forEach(el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' })
    }, 20)
  }, [items.length, activeFolder])

  useEffect(() => { if (showNewFolder) newFolderRef.current?.focus() }, [showNewFolder])
  useEffect(() => { if (renamingFolder) folderRenameRef.current?.focus() }, [renamingFolder])

  const save = (newItems, newFolders) => {
    setItems(newItems); setFolders(newFolders || folders)
    onSave({ items: newItems, folders: newFolders || folders })
  }

  const addTask = () => {
    if (!newText.trim()) return
    const folder = activeFolder === 'all' ? '' : activeFolder
    save([...items, { id: uid(), text: newText.trim(), done: false, folder }]); setNewText('')
    setTimeout(() => newRef.current?.focus(), 50)
  }

  const toggleDone = id => save(items.map(t => t.id === id ? { ...t, done: !t.done } : t))
  const updateText = (id, text) => save(items.map(t => t.id === id ? { ...t, text } : t))
  const deleteTask = id => save(items.filter(t => t.id !== id))
  const moveToFolder = (taskId, folderId) => { save(items.map(t => t.id === taskId ? { ...t, folder: folderId } : t)); setFolderMenu(null) }

  const addFolder = () => {
    if (!newFolderName.trim()) return
    const nf = [...folders, { id: uid(), name: newFolderName.trim() }]
    setFolders(nf); save(items, nf); setNewFolderName(''); setShowNewFolder(false)
  }

  const renameFolder = (fid, name) => {
    const nf = folders.map(f => f.id === fid ? { ...f, name } : f)
    setFolders(nf); save(items, nf); setRenamingFolder(null)
  }

  const deleteFolder = (fid) => {
    const nf = folders.filter(f => f.id !== fid)
    const ni = items.map(t => t.folder === fid ? { ...t, folder: '' } : t)
    setFolders(nf); if (activeFolder === fid) setActiveFolder('all'); save(ni, nf)
  }

  const filtered = activeFolder === 'all' ? items : items.filter(t => (t.folder || '') === (activeFolder === 'uncategorized' ? '' : activeFolder))
  const doneCount = filtered.filter(t => t.done).length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={() => folderMenu && setFolderMenu(null)}>
      {/* Folder picker dropdown */}
      {folderMenu && (
        <div style={{ position: 'fixed', left: folderMenu.x, top: folderMenu.y, zIndex: 9999, background: '#111214', border: '1px solid var(--border-hi)', borderRadius: 8, padding: '4px 0', minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,.6)' }}>
          <div onClick={() => moveToFolder(folderMenu.taskId, '')} style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#fff' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(88,101,242,.15)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>No folder</div>
          {folders.map(f => (
            <div key={f.id} onClick={() => moveToFolder(folderMenu.taskId, f.id)} style={{ padding: '8px 14px', cursor: 'pointer', fontSize: 13, color: '#fff' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(88,101,242,.15)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>📁 {f.name}</div>
          ))}
        </div>
      )}

      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: '#2b2d31' }}>
        <h2 style={{ fontSize: fontSize + 6, fontWeight: 700, color: '#fff' }}>💞 Tasks</h2>
        <div style={{ fontSize: fontSize - 2, color: 'var(--text-dim)', marginTop: 3 }}>{doneCount}/{filtered.length} completed</div>
      </div>

      {/* Folder tabs */}
      <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: '#2b2d31' }}>
        <div onClick={() => setActiveFolder('all')} style={{
          padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: fontSize * 0.8, fontWeight: 600,
          background: activeFolder === 'all' ? 'rgba(245,169,208,.15)' : 'transparent',
          color: activeFolder === 'all' ? '#fff' : 'var(--text-dim)',
          border: `1px solid ${activeFolder === 'all' ? 'rgba(245,169,208,.3)' : 'transparent'}`,
        }}>All ({items.length})</div>

        {folders.map(f => {
          const count = items.filter(t => t.folder === f.id).length
          const isActive = activeFolder === f.id
          return (
            <div key={f.id} onClick={() => setActiveFolder(f.id)}
              onContextMenu={e => { e.preventDefault(); setRenamingFolder(f.id); setFolderRenameText(f.name) }}
              style={{
                padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontSize: fontSize * 0.8, fontWeight: 600,
                background: isActive ? 'rgba(88,101,242,.15)' : 'transparent',
                color: isActive ? '#fff' : 'var(--text-dim)',
                border: `1px solid ${isActive ? 'rgba(88,101,242,.3)' : 'transparent'}`,
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
              {renamingFolder === f.id ? (
                <input ref={folderRenameRef} value={folderRenameText} onChange={e => setFolderRenameText(e.target.value)}
                  onBlur={() => { if (folderRenameText.trim()) renameFolder(f.id, folderRenameText.trim()); else setRenamingFolder(null) }}
                  onKeyDown={e => { if (e.key === 'Enter' && folderRenameText.trim()) renameFolder(f.id, folderRenameText.trim()); if (e.key === 'Escape') setRenamingFolder(null) }}
                  onClick={e => e.stopPropagation()}
                  style={{ background: 'var(--input)', border: '1px solid var(--accent)', borderRadius: 4, color: '#fff', padding: '2px 6px', fontSize: 'inherit', outline: 'none', width: 80 }} />
              ) : (
                <span>📁 {f.name} ({count})</span>
              )}
              {renamingFolder !== f.id && <span onClick={e => { e.stopPropagation(); deleteFolder(f.id) }} style={{ fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer', marginLeft: 2 }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}>✕</span>}
            </div>
          )
        })}

        {showNewFolder ? (
          <div style={{ display: 'flex', gap: 4 }}>
            <input ref={newFolderRef} value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') { setShowNewFolder(false); setNewFolderName('') } }}
              placeholder="Folder name..."
              style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--input)', color: '#fff', fontSize: fontSize * 0.8, outline: 'none', width: 100 }} />
            <button onClick={addFolder} style={{ background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: fontSize * 0.75, fontWeight: 600 }}>Add</button>
          </div>
        ) : (
          <div onClick={() => setShowNewFolder(true)} style={{
            padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: fontSize * 0.8,
            color: 'var(--text-dim)', border: '1px dashed var(--border)',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}>+ Folder</div>
        )}
      </div>

      {/* Task list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(task => {
            const taskFolder = folders.find(f => f.id === task.folder)
            return (
              <div key={task.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                background: task.done ? 'rgba(35,165,89,.08)' : 'var(--card)',
                border: `1px solid ${task.done ? 'rgba(35,165,89,.2)' : 'var(--border)'}`,
                borderRadius: 10,
              }}>
                <div onClick={() => toggleDone(task.id)} style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: 'pointer', marginTop: 2,
                  border: `2px solid ${task.done ? '#23a559' : 'var(--border)'}`,
                  background: task.done ? '#23a559' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .12s',
                }}>
                  {task.done && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>}
                </div>
                <textarea data-autosize ref={autoSize} value={task.text} onChange={e => { updateText(task.id, e.target.value); autoSize(e.target) }}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', color: task.done ? 'var(--text-dim)' : '#fff',
                    fontSize, outline: 'none', resize: 'none', lineHeight: 1.5, padding: 0,
                    textDecoration: task.done ? 'line-through' : 'none', fontFamily: 'inherit',
                    overflow: 'hidden', minHeight: '1.5em',
                  }} />
                {taskFolder && activeFolder === 'all' && (
                  <span style={{ fontSize: fontSize * 0.65, color: 'var(--text-dim)', background: 'rgba(88,101,242,.1)', padding: '2px 8px', borderRadius: 4, flexShrink: 0, marginTop: 3 }}>
                    📁 {taskFolder.name}
                  </span>
                )}
                <button onClick={e => { e.stopPropagation(); setFolderMenu({ taskId: task.id, x: e.clientX - 140, y: e.clientY + 4 }) }} style={{
                  background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 15,
                  cursor: 'pointer', padding: '2px 4px', flexShrink: 0, marginTop: 2,
                }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'} title="Move to folder">📁</button>
                <button onClick={() => deleteTask(task.id)} style={{
                  background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: 16,
                  cursor: 'pointer', padding: '2px 4px', flexShrink: 0, marginTop: 2,
                }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}>✕</button>
              </div>
            )
          })}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
            border: '1px dashed var(--border)', borderRadius: 10,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 6, flexShrink: 0,
              border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2,
            }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 16 }}>+</span>
            </div>
            <textarea ref={newRef} value={newText} onChange={e => { setNewText(e.target.value); autoSize(e.target) }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addTask() } }}
              placeholder="Add a task... (Enter to save)"
              style={{
                flex: 1, background: 'transparent', border: 'none', color: '#fff',
                fontSize, outline: 'none', resize: 'none', lineHeight: 1.5, padding: 0,
                fontFamily: 'inherit', overflow: 'hidden', minHeight: '1.5em',
              }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared Calendar (Our Schedule) ────────────────────────────────────────────
function SharedCalendarView({ workData, onSelect, fontSize }) {
  const today = new Date(); const [year, setYear] = useState(today.getFullYear()); const [month, setMonth] = useState(today.getMonth())
  const cells = getCalendarDays(year, month)
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  const isToday = n => n === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  const getDayName = n => { const d = new Date(year, month, n); return DAYS_HEADER[d.getDay() === 0 ? 6 : d.getDay() - 1] }
  let leoDays = 0, olivkaDays = 0
  cells.forEach(n => { if (!n) return; const d = workData[dateKey(year, month, n)]; if (d?.leo) leoDays++; if (d?.olivka) olivkaDays++ })
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', background: '#2b2d31' }}>
        <h2 style={{ fontSize: fontSize + 6, fontWeight: 700, color: '#fff' }}>💞 Our Schedule</h2>
        <div style={{ display: 'flex', gap: 16, marginTop: 4 }}><span style={{ fontSize: fontSize - 2, color: '#5bcefa', fontWeight: 600 }}>Leo: {leoDays} days</span><span style={{ fontSize: fontSize - 2, color: '#f5a9d0', fontWeight: 600 }}>Olivka: {olivkaDays} days</span></div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[['#5bcefa','Leo works'],['#f5a9d0','Olivka works'],['linear-gradient(90deg,#5bcefa 50%,#f5a9d0 50%)','Both work'],['#90ee90','Day off']].map(([bg,t])=><div key={t} style={{display:'flex',alignItems:'center',gap:6}}><div style={{width:16,height:16,borderRadius:4,background:bg}}/><span style={{fontSize:13,color:'var(--text-mid)'}}>{t}</span></div>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
          <button onClick={prevMonth} style={{ background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', padding: '8px 16px', cursor: 'pointer', fontSize, fontWeight: 600 }}>←</button>
          <span style={{ fontSize: fontSize + 4, fontWeight: 700, color: '#fff', minWidth: 200, textAlign: 'center' }}>{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} style={{ background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', padding: '8px 16px', cursor: 'pointer', fontSize, fontWeight: 600 }}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((dn, i) => {
            if (dn === null) return <div key={`e-${i}`} />
            const dk = dateKey(year, month, dn); const d = workData[dk] || {}
            const hasL = d.leo, hasO = d.olivka, hasN = !!d.note
            const bg = hasL && hasO ? 'linear-gradient(90deg,#5bcefa 50%,#f5a9d0 50%)' : hasL ? '#5bcefa' : hasO ? '#f5a9d0' : '#90ee90'
            return <div key={dn} onClick={() => onSelect(dk, dn, d)} style={{ minHeight: 80, padding: 8, borderRadius: 8, cursor: 'pointer', background: bg, border: `2px solid ${isToday(dn) ? '#fff' : 'transparent'}`, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'} onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              {hasN && <div style={{ position: 'absolute', top: -1, right: -1, width: 0, height: 0, borderTop: '24px solid #e53e3e', borderLeft: '24px solid transparent' }} />}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontSize: fontSize * 0.9, fontWeight: 700, color: '#111', background: isToday(dn) ? '#fff' : 'transparent', minWidth: isToday(dn) ? 26 : 'auto', height: isToday(dn) ? 26 : 'auto', padding: isToday(dn) ? '0 6px' : 0, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{dn}</span>
                <span style={{ fontSize: fontSize * 0.6, color: 'rgba(0,0,0,.5)', fontWeight: 700, textTransform: 'uppercase' }}>{getDayName(dn)}</span>
              </div>
              {(hasL || hasO) && <div style={{ fontSize: fontSize * 0.65, fontWeight: 700, color: 'rgba(0,0,0,.6)', marginTop: 2 }}>{hasL && hasO ? 'Leo & Olivka' : hasL ? 'Leo' : 'Olivka'}</div>}
            </div>
          })}
        </div>
      </div>
    </div>
  )
}

// ─── YouTube Calendar (date-based via schedule_data) ───────────────────────────
function CalendarView({ scheduleData, channelId, channelName, onSelect, onSwapDays, fontSize }) {
  const today = new Date(); const [year, setYear] = useState(today.getFullYear()); const [month, setMonth] = useState(today.getMonth())
  const [dragFrom, setDragFrom] = useState(null); const [dragOver, setDragOver] = useState(null)
  const [ghostPos, setGhostPos] = useState(null); const [ghostText, setGhostText] = useState(''); const [mouseDown, setMouseDown] = useState(false)
  const cells = getCalendarDays(year, month)
  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  const isToday = n => n === today.getDate() && month === today.getMonth() && year === today.getFullYear()
  const getDayName = n => { const d = new Date(year, month, n); return DAYS_HEADER[d.getDay() === 0 ? 6 : d.getDay() - 1] }

  // Count stats for current month
  let planned = 0, uploaded = 0
  cells.forEach(n => { if (!n) return; const d = scheduleData[dateKey(year, month, n)]; if (d?.title) planned++; if (d?.status === 'uploaded') uploaded++ })
  const total = new Date(year, month + 1, 0).getDate()

  const handleMouseDown = (e, dk, dn) => {
    const d = scheduleData[dk]; if (!d || (!d.title && !d.status)) return
    e.preventDefault(); setMouseDown(true); setDragFrom(dk); setGhostText(d.title || dk); setGhostPos({ x: e.clientX, y: e.clientY })
    const onMove = ev => { setGhostPos({ x: ev.clientX, y: ev.clientY }); const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-dk]'); if (el) setDragOver(el.getAttribute('data-dk')); else setDragOver(null) }
    const onUp = ev => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); const el = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-dk]'); if (el) { const toKey = el.getAttribute('data-dk'); if (toKey && toKey !== dk) onSwapDays(channelId, dk, toKey) }; setDragFrom(null); setDragOver(null); setGhostPos(null); setMouseDown(false) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: mouseDown ? 'none' : 'auto' }}>
      {ghostPos && dragFrom && <div style={{ position: 'fixed', left: ghostPos.x + 14, top: ghostPos.y - 16, zIndex: 10000, pointerEvents: 'none', background: 'var(--accent)', color: '#fff', padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, boxShadow: '0 6px 20px rgba(0,0,0,.5)', opacity: 0.95, whiteSpace: 'nowrap', transform: 'rotate(2deg)' }}>{ghostText}</div>}
      <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#2b2d31' }}>
        <div><h2 style={{ fontSize: fontSize + 6, fontWeight: 700, color: '#fff' }}>{channelName} — 📆 Schedule</h2><div style={{ fontSize: fontSize - 2, color: 'var(--text-dim)', marginTop: 3 }}>{planned}/{total} planned · {uploaded}/{total} uploaded</div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 150, height: 7, borderRadius: 4, background: 'var(--input)', overflow: 'hidden' }}><div style={{ width: `${total ? (uploaded / total) * 100 : 0}%`, height: '100%', borderRadius: 4, background: 'var(--green)' }} /></div><span style={{ fontSize: fontSize - 1, color: 'var(--text-mid)', fontWeight: 600 }}>{total ? Math.round((uploaded / total) * 100) : 0}%</span></div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 20 }}>
          <button onClick={prevMonth} style={{ background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', padding: '8px 16px', cursor: 'pointer', fontSize, fontWeight: 600 }}>←</button>
          <span style={{ fontSize: fontSize + 4, fontWeight: 700, color: '#fff', minWidth: 200, textAlign: 'center' }}>{MONTH_NAMES[month]} {year}</span>
          <button onClick={nextMonth} style={{ background: 'var(--input)', border: '1px solid var(--border)', borderRadius: 8, color: '#fff', padding: '8px 16px', cursor: 'pointer', fontSize, fontWeight: 600 }}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {cells.map((dn, i) => {
            if (dn === null) return <div key={`e-${i}`} />
            const dk = dateKey(year, month, dn); const d = scheduleData[dk] || {}
            const st = STATUS_MAP[d.status]; const has = d.title || d.status; const isDT = dragOver === dk && dragFrom !== dk
            return <div key={dn} data-dk={dk} onMouseDown={e => { if (has) handleMouseDown(e, dk, dn) }} onClick={() => { if (!dragFrom) onSelect(dk, dn, d) }}
              style={{ minHeight: 95, padding: 8, borderRadius: 8, background: isDT ? 'rgba(88,101,242,.25)' : st ? st.bg : isToday(dn) ? 'rgba(88,101,242,.12)' : 'var(--card)', border: `2px solid ${isDT ? 'var(--accent)' : isToday(dn) ? 'var(--accent)' : st ? st.color + '33' : 'var(--border)'}`, cursor: has ? 'grab' : 'pointer', display: 'flex', flexDirection: 'column', opacity: dragFrom === dk ? 0.35 : 1, transition: dragFrom ? 'none' : 'border-color .1s', transform: isDT ? 'scale(1.02)' : 'none' }}
              onMouseEnter={e => { if (!dragFrom) e.currentTarget.style.background = 'var(--card-hi)' }} onMouseLeave={e => { if (!dragFrom) e.currentTarget.style.background = st ? st.bg : isToday(dn) ? 'rgba(88,101,242,.12)' : 'var(--card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: fontSize * 0.85, fontWeight: 600, color: isToday(dn) ? '#fff' : st ? st.color : 'var(--text-mid)', background: isToday(dn) ? 'var(--accent)' : 'transparent', minWidth: isToday(dn) ? 26 : 'auto', height: isToday(dn) ? 26 : 'auto', padding: isToday(dn) ? '0 6px' : 0, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{dn}</span>
                <span style={{ fontSize: fontSize * 0.65, color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>{getDayName(dn)}</span>
                <div style={{ flex: 1 }} />{d.status === 'uploaded' && <span style={{ color: 'var(--green)', fontSize: 12 }}>✓</span>}
              </div>
              {d.title && <div style={{ fontSize: fontSize * 0.72, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{d.title}</div>}
              {st && <div style={{ marginTop: 'auto', paddingTop: 4 }}><span style={{ fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 3, background: st.bg, color: st.color }}>{st.label}</span></div>}
            </div>
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Channel Info ──────────────────────────────────────────────────────────────
function ChannelInfo({ channel, onUpdate, fontSize }) {
  const extraFields = channel.extra_fields || []
  const extraData = channel.extra_data || {}
  const [f, setF] = useState({})
  const timer = useRef(null)
  const [renamingField, setRenamingField] = useState(null); const [fieldRenameText, setFieldRenameText] = useState(''); const fieldRenameRef = useRef()

  useEffect(() => {
    const d = {}
    ;['credentials','proxies','adsense'].forEach(k => d[k] = channel[k] || '')
    extraFields.forEach(ef => d[ef.id] = extraData[ef.id] || '')
    setF(d)
  }, [channel.id, JSON.stringify(extraFields), JSON.stringify(extraData)])

  useEffect(() => { if (renamingField) fieldRenameRef.current?.focus() }, [renamingField])

  const saveBuiltin = (k, v) => {
    const next = { ...f, [k]: v }; setF(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { editChannel(channel.id, { [k]: v }); onUpdate() }, 300)
  }

  const saveExtra = (fieldId, v) => {
    const next = { ...f, [fieldId]: v }; setF(next)
    const newData = { ...extraData, [fieldId]: v }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { editChannel(channel.id, { extra_data: newData }); onUpdate() }, 300)
  }

  const addField = () => { const nid = uid(); editChannel(channel.id, { extra_fields: [...extraFields, { id: nid, name: 'New Field' }] }); onUpdate(); setTimeout(() => { setRenamingField(nid); setFieldRenameText('New Field') }, 100) }
  const renameField = (fid, n) => { editChannel(channel.id, { extra_fields: extraFields.map(ef => ef.id === fid ? { ...ef, name: n } : ef) }); setRenamingField(null); onUpdate() }
  const deleteField = fid => {
    const newData = { ...extraData }; delete newData[fid]
    editChannel(channel.id, { extra_fields: extraFields.filter(ef => ef.id !== fid), extra_data: newData }); onUpdate()
  }

  const inp = { width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input)', color: '#fff', fontSize, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 }
  const lbl = { fontSize: fontSize * 0.85, fontWeight: 700, color: 'var(--text-mid)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, display: 'block' }
  return <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
    <h2 style={{ fontSize: fontSize + 6, fontWeight: 700, marginBottom: 28, color: '#fff' }}>Channel Information</h2>
    <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div><label style={lbl}>Credentials</label><textarea value={f.credentials||''} onChange={e => saveBuiltin('credentials', e.target.value)} placeholder="Login details, API keys..." rows={5} style={inp} /></div>
      <div><label style={lbl}>Proxies</label><textarea value={f.proxies||''} onChange={e => saveBuiltin('proxies', e.target.value)} placeholder="Proxy addresses..." rows={5} style={inp} /></div>
      <div><label style={lbl}>Adsense</label><textarea value={f.adsense||''} onChange={e => saveBuiltin('adsense', e.target.value)} placeholder="Adsense details..." rows={5} style={inp} /></div>
      {extraFields.map(ef => <div key={ef.id}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>{renamingField === ef.id ? <input ref={fieldRenameRef} value={fieldRenameText} onChange={e => setFieldRenameText(e.target.value)} onBlur={() => { if (fieldRenameText.trim()) renameField(ef.id, fieldRenameText.trim()); else setRenamingField(null) }} onKeyDown={e => { if (e.key==='Enter'&&fieldRenameText.trim()) renameField(ef.id,fieldRenameText.trim()); if (e.key==='Escape') setRenamingField(null) }} style={{ background:'var(--input)',border:'1px solid var(--accent)',borderRadius:4,color:'#fff',padding:'2px 8px',fontSize:fontSize*0.85,fontWeight:700,outline:'none',textTransform:'uppercase',letterSpacing:'.08em' }} /> : <label onDoubleClick={() => { setRenamingField(ef.id); setFieldRenameText(ef.name) }} style={{ ...lbl, marginBottom: 0, cursor: 'pointer' }}>{ef.name}</label>}<button onClick={() => deleteField(ef.id)} style={{ background:'none',border:'none',color:'var(--red)',fontSize:14,cursor:'pointer',opacity:0.6 }}>✕</button></div><textarea value={f[ef.id]||''} onChange={e => saveExtra(ef.id, e.target.value)} placeholder={`${ef.name} details...`} rows={5} style={inp} /></div>)}
      <button onClick={addField} style={{ padding:14,border:'1px dashed var(--border)',borderRadius:8,background:'transparent',color:'var(--text-dim)',fontSize,cursor:'pointer' }} onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.color='#fff' }} onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text-dim)' }}>+ Add Field</button>
    </div>
  </div>
}

function CustomCategoryPage({ channel, categoryId, fontSize }) {
  const cats = channel.categories || DEFAULT_CATS; const cat = cats.find(c => c.id === categoryId)
  const extraData = channel.extra_data || {}
  const [notes, setNotes] = useState(''); const timer = useRef(null)
  useEffect(() => { setNotes(extraData[`cat_${categoryId}`] || '') }, [channel.id, categoryId, JSON.stringify(extraData)])
  const save = v => {
    setNotes(v); clearTimeout(timer.current)
    timer.current = setTimeout(() => editChannel(channel.id, { extra_data: { ...extraData, [`cat_${categoryId}`]: v } }), 300)
  }
  return <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}><h2 style={{ fontSize: fontSize + 6, fontWeight: 700, marginBottom: 28, color: '#fff' }}>{cat?.name || 'Category'}</h2><textarea value={notes} onChange={e => save(e.target.value)} placeholder="Type your notes here..." style={{ width: '100%', minHeight: 400, padding: 16, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--input)', color: '#fff', fontSize, outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.6 }} /></div>
}

// ─── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, profile, signOut } = useAuth()
  const [channels, setChannels] = useState([]); const [profiles, setProfiles] = useState([])
  const [activeCh, setActiveCh] = useState(null); const [tab, setTab] = useState('info')
  const [selDay, setSelDay] = useState(null) // { dateKey, dayNum, data, channelId }
  const [sharedChId, setSharedChId] = useState(null); const [workData, setWorkData] = useState({})
  const [sharedExpanded, setSharedExpanded] = useState(true); const [sharedActive, setSharedActive] = useState(false)
  const [sharedTab, setSharedTab] = useState('schedule') // 'schedule' or 'tasks'
  const [selSharedDate, setSelSharedDate] = useState(null)
  const [online, setOnline] = useState([]); const [sideW, setSideW] = useState(280); const [fontSize, setFontSize] = useState(16)
  const [editName, setEditName] = useState(false); const [dispName, setDispName] = useState('')
  const [showNickPrompt, setShowNickPrompt] = useState(false)
  const [newChName, setNewChName] = useState(''); const [showNewCh, setShowNewCh] = useState(false)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [renamingChId, setRenamingChId] = useState(null); const [chRenameText, setChRenameText] = useState('')
  const [renamingCat, setRenamingCat] = useState(null); const [catRenameText, setCatRenameText] = useState('')
  const [expandedChannels, setExpandedChannels] = useState({})
  const [dragCat, setDragCat] = useState(null); const [dragOverCat, setDragOverCat] = useState(null)
  const [installPrompt, setInstallPrompt] = useState(null)
  const nameRef = useRef(); const newChRef = useRef(); const chRenameRef = useRef(); const catRenameRef = useRef()

  // Capture PWA install prompt
  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const load = useCallback(async () => {
    const [ch, pr] = await Promise.all([getChannels(), getProfiles()])
    let shared = ch.find(c => c.name === '__shared_schedule__')
    if (!shared && user) { try { shared = await addChannel('__shared_schedule__', user.id); ch.push(shared) } catch (e) {} }
    if (shared) { setSharedChId(shared.id); setWorkData(shared.work_data || {}) }
    setChannels(ch.filter(c => c.name !== '__shared_schedule__')); setProfiles(pr)
  }, [user])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (profile) { const f = profiles.find(p => p.id === user?.id); const n = f?.display_name || profile.display_name || ''; if (!editName) setDispName(n); if (n === profile.email?.split('@')[0] && profiles.length <= 1) setShowNickPrompt(true) } }, [profile, profiles])
  useEffect(() => { if (editName) nameRef.current?.focus() }, [editName])
  useEffect(() => { if (showNewCh) newChRef.current?.focus() }, [showNewCh])
  useEffect(() => { if (renamingChId) chRenameRef.current?.focus() }, [renamingChId])
  useEffect(() => { if (renamingCat) catRenameRef.current?.focus() }, [renamingCat])
  useEffect(() => { const s = onChannelsChange(() => load()); return () => supabase.removeChannel(s) }, [load])
  useEffect(() => { if (!user) return; const ch = supabase.channel('presence',{config:{presence:{key:user.id}}}); ch.on('presence',{event:'sync'},()=>setOnline(Object.keys(ch.presenceState()))).subscribe(async s=>{if(s==='SUBSCRIBED')await ch.track({id:user.id})}); return ()=>supabase.removeChannel(ch) }, [user])

  const startResize = e => { e.preventDefault(); const sx=e.clientX,sw=sideW; const mv=ev=>setSideW(Math.max(220,Math.min(500,sw+ev.clientX-sx))); const up=()=>{document.removeEventListener('mousemove',mv);document.removeEventListener('mouseup',up)}; document.addEventListener('mousemove',mv);document.addEventListener('mouseup',up) }
  const toggleExpand = chId => setExpandedChannels(prev => ({ ...prev, [chId]: !prev[chId] }))

  const handleNewChannel = async () => { const name = newChName.trim() || `Channel ${channels.filter(c=>c.user_id===user?.id).length+1}`; setNewChName(''); setShowNewCh(false); const tid = 'temp-'+uid(); const tc = {id:tid,name,user_id:user.id,categories:DEFAULT_CATS,credentials:'',proxies:'',adsense:'',extra_fields:[],schedule_data:{}}; setChannels(p=>[...p,tc]); setActiveCh(tid); setTab('info'); setSharedActive(false); setExpandedChannels(p=>({...p,[tid]:true})); try { const ch = await addChannel(name,user.id); setChannels(p=>p.map(c=>c.id===tid?ch:c)); setActiveCh(ch.id); setExpandedChannels(p=>{const n={...p};delete n[tid];n[ch.id]=true;return n}); toast.success(`Created "${name}"`) } catch(e){ setChannels(p=>p.filter(c=>c.id!==tid)); toast.error('Failed: '+e.message) } }
  const handleRenameChannel = (chId,newName) => { setChannels(p=>p.map(c=>c.id===chId?{...c,name:newName}:c)); setRenamingChId(null); editChannel(chId,{name:newName}) }
  const handleDuplicateChannel = async ch => { try { const dup=await addChannel(ch.name+' (copy)',user.id); await editChannel(dup.id,{credentials:ch.credentials,proxies:ch.proxies,adsense:ch.adsense,categories:ch.categories}); await load(); toast.success('Duplicated!') } catch(e){toast.error('Failed: '+e.message)} }

  // Save a YouTube schedule day (date-based on channel.schedule_data)
  const handleSaveScheduleDay = (channelId, dk, data) => {
    setChannels(prev => prev.map(c => { if (c.id !== channelId) return c; return { ...c, schedule_data: { ...(c.schedule_data || {}), [dk]: data } } }))
    setSelDay(prev => prev && prev.dateKey === dk ? { ...prev, data } : prev)
    const ch = channels.find(c => c.id === channelId)
    editChannel(channelId, { schedule_data: { ...(ch?.schedule_data || {}), [dk]: data } })
  }

  // Swap two YouTube schedule days
  const handleSwapDays = (channelId, fromKey, toKey) => {
    const ch = channels.find(c => c.id === channelId)
    const sd = { ...(ch?.schedule_data || {}) }; const tmp = sd[fromKey] || {}; sd[fromKey] = sd[toKey] || {}; sd[toKey] = tmp
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, schedule_data: sd } : c))
    editChannel(channelId, { schedule_data: sd })
  }

  // Save a shared work day
  const handleSaveWorkDay = (dk, data) => {
    const nw = { ...workData, [dk]: data }; setWorkData(nw)
    if (sharedChId) editChannel(sharedChId, { work_data: nw })
  }

  const handleSaveTasks = (tasks) => {
    const nw = { ...workData, __tasks__: tasks }; setWorkData(nw)
    if (sharedChId) editChannel(sharedChId, { work_data: nw })
  }

  const handleSaveNickname = async name => { setDispName(name); setShowNickPrompt(false); toast.success(`Welcome, ${name}!`); editProfile(user.id,{display_name:name}).then(()=>load()) }
  const handleSaveDisplayName = async () => { setEditName(false); const t=dispName.trim(); const c=profiles.find(p=>p.id===user?.id)?.display_name||''; if(t&&t!==c){toast.success('Name updated!');editProfile(user.id,{display_name:t}).then(()=>load())} }

  const addSchedule = chId => { const ch=channels.find(c=>c.id===chId); const cats=ch?.categories||DEFAULT_CATS; if(cats.some(c=>c.type==='schedule')){toast('Schedule already exists');return}; const nc=[...cats,{id:uid(),name:'Schedule',type:'schedule'}]; setChannels(p=>p.map(c=>c.id===chId?{...c,categories:nc}:c)); setExpandedChannels(p=>({...p,[chId]:true})); editChannel(chId,{categories:nc}) }
  const addCategory = chId => { const ch=channels.find(c=>c.id===chId); const cats=ch?.categories||DEFAULT_CATS; const nid=uid(); const nc=[...cats,{id:nid,name:'New Category',type:'custom'}]; setChannels(p=>p.map(c=>c.id===chId?{...c,categories:nc}:c)); setExpandedChannels(p=>({...p,[chId]:true})); setRenamingCat({chId,catId:nid}); setCatRenameText('New Category'); editChannel(chId,{categories:nc}) }
  const handleRenameCategory = (chId,catId,newName) => { setChannels(p=>p.map(c=>{if(c.id!==chId)return c;return{...c,categories:(c.categories||DEFAULT_CATS).map(cat=>cat.id===catId?{...cat,name:newName}:cat)}})); setRenamingCat(null); const ch=channels.find(c=>c.id===chId); editChannel(chId,{categories:(ch?.categories||DEFAULT_CATS).map(cat=>cat.id===catId?{...cat,name:newName}:cat)}) }
  const deleteCategory = (chId,catId) => { const ch=channels.find(c=>c.id===chId); const cats=(ch?.categories||DEFAULT_CATS).filter(c=>c.id!==catId); setChannels(p=>p.map(c=>c.id===chId?{...c,categories:cats}:c)); if(tab===catId)setTab(cats[0]?.id||'info'); editChannel(chId,{categories:cats}) }
  const duplicateCategory = (chId,catId) => { const ch=channels.find(c=>c.id===chId); const cats=ch?.categories||DEFAULT_CATS; const cat=cats.find(c=>c.id===catId); if(!cat)return; const nc=[...cats,{id:uid(),name:cat.name+' (copy)',type:cat.type==='schedule'?'schedule':cat.type==='info'?'custom':cat.type}]; setChannels(p=>p.map(c=>c.id===chId?{...c,categories:nc}:c)); editChannel(chId,{categories:nc}) }
  const handleCatDragEnd = chId => { if(!dragCat||!dragOverCat||dragCat===dragOverCat){setDragCat(null);setDragOverCat(null);return}; const ch=channels.find(c=>c.id===chId); const cats=[...(ch?.categories||DEFAULT_CATS)]; const fi=cats.findIndex(c=>c.id===dragCat); const ti=cats.findIndex(c=>c.id===dragOverCat); if(fi<0||ti<0)return; const[m]=cats.splice(fi,1); cats.splice(ti,0,m); setChannels(p=>p.map(c=>c.id===chId?{...c,categories:cats}:c)); editChannel(chId,{categories:cats}); setDragCat(null);setDragOverCat(null) }

  const myProfile=profiles.find(p=>p.id===user?.id)||profile; const myName=dispName||myProfile?.display_name||user?.email?.split('@')[0]||'?'
  const activeChannel=channels.find(c=>c.id===activeCh); const myChannels=channels.filter(c=>c.user_id===user?.id)
  const otherUsers=profiles.filter(p=>p.id!==user?.id); const profileIds=new Set(profiles.map(p=>p.id)); const orphans=channels.filter(c=>c.user_id&&!profileIds.has(c.user_id))

  const renderChannelItem = (ch, canEdit, accent='var(--accent)') => {
    const cats=ch.categories||DEFAULT_CATS; const isActive=activeCh===ch.id&&!sharedActive; const isExpanded=expandedChannels[ch.id]??isActive; const isRenaming=renamingChId===ch.id
    return <div key={ch.id}>
      <div onClick={()=>{if(isRenaming)return;setSharedActive(false);if(activeCh===ch.id&&!sharedActive)toggleExpand(ch.id);else{setActiveCh(ch.id);setSelDay(null);setTab(cats[0]?.id||'info');setExpandedChannels(p=>({...p,[ch.id]:true}))}}}
        onContextMenu={e=>{if(!canEdit)return;e.preventDefault();setCtxMenu({x:e.clientX,y:e.clientY,items:[{label:'Rename',action:()=>{setRenamingChId(ch.id);setChRenameText(ch.name)}},{label:'📆 Add Schedule',action:()=>addSchedule(ch.id)},{label:'Add Category',action:()=>addCategory(ch.id)},{label:'Duplicate',action:()=>handleDuplicateChannel(ch)},{divider:true},{label:'Delete',danger:true,action:()=>{removeChannel(ch.id);setChannels(p=>p.filter(c=>c.id!==ch.id));if(activeCh===ch.id){setActiveCh(null);setSelDay(null)}}}]})}}
        style={{padding:'9px 14px 9px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,background:isActive?'rgba(88,101,242,.12)':'transparent',borderLeft:isActive?`3px solid ${accent}`:'3px solid transparent',color:'#fff',fontWeight:isActive?600:400}}>
        <Arrow open={isExpanded}/><YTLogo size={18}/>
        {isRenaming ? <input ref={chRenameRef} value={chRenameText} onChange={e=>setChRenameText(e.target.value)} onBlur={()=>{if(chRenameText.trim())handleRenameChannel(ch.id,chRenameText.trim());else setRenamingChId(null)}} onKeyDown={e=>{if(e.key==='Enter'&&chRenameText.trim())handleRenameChannel(ch.id,chRenameText.trim());if(e.key==='Escape')setRenamingChId(null)}} onClick={e=>e.stopPropagation()} style={{background:'var(--input)',border:'1px solid var(--accent)',borderRadius:4,color:'#fff',padding:'3px 7px',fontSize:'inherit',outline:'none',flex:1,minWidth:0}}/>
        : <span onDoubleClick={e=>{if(canEdit){e.stopPropagation();setRenamingChId(ch.id);setChRenameText(ch.name)}}} style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ch.name}</span>}
      </div>
      {isExpanded && <div style={{paddingLeft:36,display:'flex',flexDirection:'column',gap:0,marginBottom:4}}>
        {cats.map(cat => { const isCR=renamingCat?.chId===ch.id&&renamingCat?.catId===cat.id; const isS=cat.type==='schedule'
          return <div key={cat.id} draggable={canEdit} onDragStart={()=>setDragCat(cat.id)} onDragOver={e=>{e.preventDefault();setDragOverCat(cat.id)}} onDragLeave={()=>setDragOverCat(null)} onDrop={()=>handleCatDragEnd(ch.id)}
            onClick={()=>{if(!isCR){setActiveCh(ch.id);setSharedActive(false);setTab(cat.id)}}}
            onContextMenu={e=>{if(!canEdit)return;e.preventDefault();setCtxMenu({x:e.clientX,y:e.clientY,items:[...(!isS?[{label:'Rename',action:()=>{setRenamingCat({chId:ch.id,catId:cat.id});setCatRenameText(cat.name)}}]:[]),{label:'Duplicate',action:()=>duplicateCategory(ch.id,cat.id)},{divider:true},{label:'Delete',danger:true,action:()=>deleteCategory(ch.id,cat.id)}]})}}
            style={{padding:'6px 12px',cursor:canEdit?'grab':'pointer',borderRadius:6,marginRight:14,background:tab===cat.id&&isActive?'rgba(88,101,242,.15)':'transparent',color:tab===cat.id&&isActive?'#fff':'var(--text-mid)',fontWeight:tab===cat.id&&isActive?600:400,borderTop:dragOverCat===cat.id?'2px solid var(--accent)':'2px solid transparent'}}>
            {isCR&&!isS ? <input ref={catRenameRef} value={catRenameText} onChange={e=>setCatRenameText(e.target.value)} onBlur={()=>{if(catRenameText.trim())handleRenameCategory(ch.id,cat.id,catRenameText.trim());else setRenamingCat(null)}} onKeyDown={e=>{if(e.key==='Enter'&&catRenameText.trim())handleRenameCategory(ch.id,cat.id,catRenameText.trim());if(e.key==='Escape')setRenamingCat(null)}} onClick={e=>e.stopPropagation()} style={{background:'var(--input)',border:'1px solid var(--accent)',borderRadius:4,color:'#fff',padding:'2px 6px',fontSize:'inherit',outline:'none',width:'100%'}}/> : isS ? `📆| ${cat.name}` : cat.name}
          </div> })}
      </div>}
    </div>
  }

  const renderMain = () => {
    if (sharedActive && sharedTab === 'tasks') return <SharedTasksView taskData={workData.__tasks__ || []} onSave={handleSaveTasks} fontSize={fontSize} />
    if (sharedActive) return <SharedCalendarView workData={workData} onSelect={(dk,dn,d)=>setSelSharedDate({dateKey:dk,dayNum:dn,data:d})} fontSize={fontSize}/>
    if (!activeChannel) return <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:'var(--text-dim)',gap:12}}><YTLogo size={60}/><div style={{fontSize:18,fontWeight:600,color:'#fff'}}>Select or create a channel</div></div>
    const cats=activeChannel.categories||DEFAULT_CATS; const ac=cats.find(c=>c.id===tab)
    if (!ac) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-dim)'}}>Select a category</div>
    if (ac.type==='info') return <ChannelInfo channel={activeChannel} onUpdate={load} fontSize={fontSize}/>
    if (ac.type==='schedule') return <CalendarView scheduleData={activeChannel.schedule_data||{}} channelId={activeChannel.id} channelName={activeChannel.name} onSelect={(dk,dn,d)=>setSelDay({dateKey:dk,dayNum:dn,data:d,channelId:activeChannel.id})} onSwapDays={handleSwapDays} fontSize={fontSize}/>
    return <CustomCategoryPage channel={activeChannel} categoryId={ac.id} fontSize={fontSize}/>
  }

  return (
    <div style={{display:'flex',height:'100vh'}} onClick={()=>ctxMenu&&setCtxMenu(null)}>
      {showNickPrompt&&<NicknamePrompt onSave={handleSaveNickname}/>}
      {ctxMenu&&<ContextMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxMenu.items} onClose={()=>setCtxMenu(null)}/>}
      <div style={{width:sideW,minWidth:220,maxWidth:500,background:'var(--sidebar)',borderRight:'1px solid var(--border)',display:'flex',flexDirection:'column',position:'relative',fontSize}}>
        <div onMouseDown={startResize} style={{position:'absolute',top:0,right:-3,bottom:0,width:6,cursor:'col-resize',zIndex:10}} onMouseEnter={e=>e.currentTarget.style.background='rgba(88,101,242,.25)'} onMouseLeave={e=>e.currentTarget.style.background='transparent'}/>
        <div style={{padding:'16px 14px 8px',borderBottom:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
            <div style={{width:38,height:38,borderRadius:50,background:'var(--accent)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:14,flexShrink:0}}>{myName.slice(0,2).toUpperCase()}</div>
            <div style={{flex:1,minWidth:0}}>
              {editName?<input ref={nameRef} value={dispName} onChange={e=>setDispName(e.target.value)} onBlur={handleSaveDisplayName} onKeyDown={e=>{if(e.key==='Enter')handleSaveDisplayName();if(e.key==='Escape')setEditName(false)}} style={{background:'var(--input)',border:'1px solid var(--accent)',borderRadius:4,color:'#fff',padding:'3px 7px',fontSize:fontSize+1,outline:'none',width:'100%',fontWeight:600}}/>
              :<div onDoubleClick={()=>{setDispName(myName);setEditName(true)}} title="Double-click to rename" style={{fontWeight:700,fontSize:fontSize+1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',cursor:'pointer',color:'#fff'}}>{myName}</div>}
              <div style={{fontSize:fontSize*0.65,color:'var(--text-dim)'}}>TUBEFLOW</div>
            </div>
            <button onClick={signOut} style={{background:'none',border:'1px solid var(--border)',borderRadius:5,color:'var(--text-dim)',fontSize:fontSize*0.7,padding:'4px 8px',cursor:'pointer',flexShrink:0}}>Sign out</button>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0'}}>
            <span style={{fontSize:12,color:'var(--text-mid)',fontWeight:600}}>A</span>
            <input type="range" min={12} max={22} value={fontSize} onChange={e=>setFontSize(Number(e.target.value))} style={{flex:1,cursor:'pointer'}}/>
            <span style={{fontSize:20,color:'var(--text-mid)',fontWeight:700}}>A</span>
            <span style={{fontSize:12,color:'var(--accent-soft)',minWidth:32,fontWeight:600}}>{fontSize}px</span>
          </div>
        </div>
        {profiles.length>1&&<div style={{padding:'8px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
          <span style={{fontSize:fontSize*0.7,color:'var(--text-dim)',fontWeight:600}}>Online:</span>
          {profiles.map(p=><div key={p.id} style={{display:'flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:10,background:p.id===user?.id?'rgba(88,101,242,.12)':'rgba(30,30,35,.5)',border:`1px solid ${p.id===user?.id?'rgba(88,101,242,.3)':'var(--border)'}`}}><div style={{width:6,height:6,borderRadius:'50%',background:online.includes(p.id)?'var(--green)':'#555'}}/><span style={{fontSize:fontSize*0.7,color:'#fff'}}>{p.id===user?.id?'You':(p.display_name||p.email?.split('@')[0])}</span></div>)}
        </div>}
        <div style={{flex:1,overflowY:'auto',padding:'6px 0'}}>
          <div onClick={()=>{if(sharedActive){setSharedExpanded(e=>!e)}else{setSharedActive(true);setActiveCh(null);setSelDay(null);setSharedExpanded(true);setSharedTab('schedule')}}} style={{padding:'9px 14px 9px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,background:sharedActive?'rgba(245,169,208,.12)':'transparent',borderLeft:sharedActive?'3px solid #f5a9d0':'3px solid transparent',color:'#fff',fontWeight:600}}>
            <Arrow open={sharedExpanded&&sharedActive}/><span style={{fontSize:16}}>💞</span><span style={{flex:1}}>Our Schedule</span>
          </div>
          {sharedActive&&sharedExpanded&&<div style={{paddingLeft:36,marginBottom:4,display:'flex',flexDirection:'column',gap:0}}>
            <div onClick={()=>setSharedTab('schedule')} style={{padding:'6px 12px',borderRadius:6,marginRight:14,background:sharedTab==='schedule'?'rgba(245,169,208,.15)':'transparent',color:sharedTab==='schedule'?'#fff':'var(--text-mid)',fontWeight:sharedTab==='schedule'?600:400,cursor:'pointer'}}>📆| Schedule</div>
            <div onClick={()=>setSharedTab('tasks')} style={{padding:'6px 12px',borderRadius:6,marginRight:14,background:sharedTab==='tasks'?'rgba(245,169,208,.15)':'transparent',color:sharedTab==='tasks'?'#fff':'var(--text-mid)',fontWeight:sharedTab==='tasks'?600:400,cursor:'pointer'}}>✅| Tasks</div>
          </div>}
          <div style={{height:1,background:'var(--border)',margin:'6px 14px'}}/>
          <div style={{padding:'8px 14px 4px',fontSize:fontSize*0.7,fontWeight:700,color:'var(--text-mid)',textTransform:'uppercase',letterSpacing:'.1em'}}>{myName}'s Channels ({myChannels.length})</div>
          {[...myChannels,...orphans].map(ch=>renderChannelItem(ch,true))}
          {showNewCh?<div style={{padding:'6px 14px',display:'flex',gap:5}}><input ref={newChRef} value={newChName} onChange={e=>setNewChName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')handleNewChannel();if(e.key==='Escape'){setShowNewCh(false);setNewChName('')}}} placeholder="Channel name..." style={{flex:1,padding:'8px 10px',borderRadius:6,border:'1px solid var(--accent)',background:'var(--input)',color:'#fff',fontSize:'inherit',outline:'none'}}/><button onClick={handleNewChannel} style={{background:'var(--accent)',border:'none',color:'#fff',borderRadius:6,padding:'8px 14px',cursor:'pointer',fontWeight:600,flexShrink:0}}>Add</button></div>
          :<button onClick={()=>setShowNewCh(true)} style={{margin:'6px 14px',padding:'10px 0',border:'1px dashed var(--border)',borderRadius:8,background:'transparent',color:'var(--text-dim)',fontSize:'inherit',cursor:'pointer',width:'calc(100% - 28px)'}} onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='#fff'}} onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-dim)'}}>+ New Channel</button>}
          {otherUsers.map(ou=>{const theirs=channels.filter(c=>c.user_id===ou.id);return<div key={ou.id}><div style={{padding:'14px 14px 4px',fontSize:fontSize*0.7,fontWeight:700,color:'var(--pink)',textTransform:'uppercase',letterSpacing:'.1em',display:'flex',alignItems:'center',gap:6}}><div style={{width:5,height:5,borderRadius:'50%',background:online.includes(ou.id)?'var(--green)':'#555'}}/>{ou.display_name||ou.email?.split('@')[0]}'s ({theirs.length})</div>{theirs.length===0&&<div style={{padding:'3px 22px',color:'var(--text-dim)'}}>No channels yet</div>}{theirs.map(ch=>renderChannelItem(ch,false,'var(--pink)'))}</div>})}
        </div>
        <div style={{padding:'10px 14px',borderTop:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <span style={{fontSize:fontSize*0.7,color:'var(--text-dim)'}}>Right-click for options</span>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span onClick={()=>{if(installPrompt){installPrompt.prompt();installPrompt.userChoice.then(r=>{if(r.outcome==='accepted'){setInstallPrompt(null);toast.success('App installed!')}})}else{toast('Use browser menu → Install app')}}} style={{fontSize:fontSize*0.7,color:'var(--accent)',cursor:'pointer',fontWeight:600}} onMouseEnter={e=>e.currentTarget.style.textDecoration='underline'} onMouseLeave={e=>e.currentTarget.style.textDecoration='none'}>📲 Install</span>
            <div style={{display:'flex',alignItems:'center',gap:4}}><div className="pulse" style={{width:6,height:6,borderRadius:'50%',background:'var(--green)'}}/><span style={{fontSize:fontSize*0.65,color:'var(--text-dim)'}}>Live sync</span></div>
          </div>
        </div>
      </div>
      {renderMain()}
      {selDay&&!sharedActive&&<><div onClick={()=>setSelDay(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:999}}/><DayPanel dateKey={selDay.dateKey} dayNum={selDay.dayNum} data={selDay.data} onSave={(dk,d)=>handleSaveScheduleDay(selDay.channelId,dk,d)} onClose={()=>setSelDay(null)} fontSize={fontSize}/></>}
      {selSharedDate&&sharedActive&&<><div onClick={()=>setSelSharedDate(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.4)',zIndex:999}}/><SharedDayPanel dateKey={selSharedDate.dateKey} dayNum={selSharedDate.dayNum} data={selSharedDate.data} onSave={(dk,d)=>{handleSaveWorkDay(dk,d);setSelSharedDate(p=>({...p,data:d}))}} onClose={()=>setSelSharedDate(null)} fontSize={fontSize}/></>}
    </div>
  )
}
