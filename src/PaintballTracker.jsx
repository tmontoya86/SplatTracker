import React, { useState, useEffect } from 'react';
import { Users, Calendar, DollarSign, Plus, Trash2, Save, Target, Shield, CheckCircle, ShoppingBag, ListPlus, X, LogOut, Lock, UserPlus, Mail, AlertTriangle, Link as LinkIcon } from 'lucide-react';

// --- CONFIGURATION ---
// We use a safe check here so it works in the Preview window AND on Netlify.
// In a real Vite app, import.meta.env is always available.
const getEnv = (key) => {
  try {
    return import.meta.env[key];
  } catch (e) {
    return ""; // Fallback for environments that don't support import.meta
  }
};

const supabaseUrl = getEnv("VITE_SUPABASE_URL");
const supabaseKey = getEnv("VITE_SUPABASE_ANON_KEY");

const isConfigured = supabaseUrl && supabaseKey && supabaseUrl !== "PASTE_YOUR_SUPABASE_URL_HERE";

export default function PaintballFinanceTracker() {
  const [supabase, setSupabase] = useState(null);
  const [isSupabaseLibraryLoaded, setIsSupabaseLibraryLoaded] = useState(false);

  const [session, setSession] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data States
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [gearOrders, setGearOrders] = useState([]);

  // Auth States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authError, setAuthError] = useState('');

  // Form States
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [makeAdmin, setMakeAdmin] = useState(false);

  const [newEvent, setNewEvent] = useState({ type: 'Practice', date: '', cost: '', attendees: [] });
  const [newOrderMeta, setNewOrderMeta] = useState({ description: '', date: '' });
  const [newLineItem, setNewLineItem] = useState({ description: '', cost: '', purchasers: [] });
  const [currentOrderItems, setCurrentOrderItems] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedPlayerForPayment, setSelectedPlayerForPayment] = useState(null);

  // 1. DYNAMIC SCRIPT LOADING
  useEffect(() => {
    if (!isConfigured) return;
    if (window.supabase && window.supabase.createClient) {
      setSupabase(window.supabase.createClient(supabaseUrl, supabaseKey));
      setIsSupabaseLibraryLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = () => {
      if (window.supabase && window.supabase.createClient) {
        setSupabase(window.supabase.createClient(supabaseUrl, supabaseKey));
        setIsSupabaseLibraryLoaded(true);
      }
    };
    document.head.appendChild(script);
  }, []);

  // 2. INITIALIZATION & ACCESS CHECK
  useEffect(() => {
    if (!supabase) return;

    const checkUserAccess = async (userEmail) => {
      if (!userEmail) return;
      
      // Check if this email exists in the players table (Roster)
      const { data, error } = await supabase
        .from('players')
        .select('is_admin')
        .eq('email', userEmail)
        .maybeSingle();
      
      if (data) {
        setIsAuthorized(true); // They are on the team
        setIsAdmin(data.is_admin); // Are they an admin?
        fetchAllData(); // Only fetch data if authorized
      } else {
        setIsAuthorized(false); // Login successful, but not on roster
        setIsAdmin(false);
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkUserAccess(session.user.email);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkUserAccess(session.user.email);
      } else {
        setIsAdmin(false);
        setIsAuthorized(false);
        setPlayers([]);
        setEvents([]);
        setGearOrders([]);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // DATA FETCHING
  const fetchAllData = async () => {
    if (!supabase) return;
    const { data: p } = await supabase.from('players').select('*').order('name');
    if (p) setPlayers(p);
    const { data: e } = await supabase.from('events').select('*').order('date', { ascending: false });
    if (e) setEvents(e);
    const { data: g } = await supabase.from('gear_orders').select('*').order('date', { ascending: false });
    if (g) setGearOrders(g);
  };

  // AUTH ACTIONS
  const handleAuth = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthError('');
    
    try {
      if (isLoginView) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        // User Self-Registration
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Success! If this is a new account, ask your Admin to approve your email.");
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  // --- ADMIN ACTIONS ---

  // Add to Roster (No Login Creation)
  const addToRoster = async (e) => {
    e.preventDefault();
    if (!newPlayerName || !newPlayerEmail) {
      alert("Name and Email are required.");
      return;
    }

    const { error } = await supabase.from('players').insert([{
      name: newPlayerName,
      email: newPlayerEmail,
      paid: 0,
      is_admin: makeAdmin
    }]);

    if (error) {
      alert("Error adding to roster: " + error.message);
    } else {
      setNewPlayerName('');
      setNewPlayerEmail('');
      setMakeAdmin(false);
      fetchAllData();
      
      // Prompt to send invite
      if (window.confirm(`${newPlayerName} added! Open email to send them an invite link?`)) {
        const subject = "Join Paintball Finance Tracker";
        const body = `Hey ${newPlayerName}, I added you to the team finance tracker. \n\nPlease go here and click 'Sign Up' using this email (${newPlayerEmail}) to set your password: \n\n${window.location.href}`;
        window.open(`mailto:${newPlayerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
      }
    }
  };

  const deletePlayer = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("Delete player?")) return;
    await supabase.from('players').delete().eq('id', id);
    fetchAllData();
  };

  const submitEvent = async () => {
    if (!isAdmin) return;
    if (!newEvent.date || !newEvent.cost || newEvent.attendees.length === 0) {
      alert("Fill all fields.");
      return;
    }
    const { error } = await supabase.from('events').insert([{
      type: newEvent.type,
      date: newEvent.date,
      cost: parseFloat(newEvent.cost),
      attendees: newEvent.attendees 
    }]);
    if (!error) {
      setNewEvent({ type: 'Practice', date: '', cost: '', attendees: [] });
      setActiveTab('dashboard');
      fetchAllData();
    }
  };

  const deleteEvent = async (id) => {
    if (!isAdmin) return;
    if (window.confirm("Delete event?")) {
      await supabase.from('events').delete().eq('id', id);
      fetchAllData();
    }
  };

  const submitFullOrder = async () => {
    if (!isAdmin) return;
    if (!newOrderMeta.date || !newOrderMeta.description || currentOrderItems.length === 0) {
      alert("Missing details.");
      return;
    }
    const { error } = await supabase.from('gear_orders').insert([{
      description: newOrderMeta.description,
      date: newOrderMeta.date,
      line_items: currentOrderItems
    }]);
    if (!error) {
      setNewOrderMeta({ description: '', date: '' });
      setNewLineItem({ description: '', cost: '', purchasers: [] });
      setCurrentOrderItems([]);
      setActiveTab('dashboard');
      fetchAllData();
    }
  };

  const deleteOrder = async (id) => {
    if (!isAdmin) return;
    if (window.confirm("Delete order?")) {
      await supabase.from('gear_orders').delete().eq('id', id);
      fetchAllData();
    }
  };

  const recordPayment = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!selectedPlayerForPayment || !paymentAmount) return;
    
    const player = players.find(p => p.id === parseInt(selectedPlayerForPayment));
    if (!player) return;

    const newPaidTotal = (player.paid || 0) + parseFloat(paymentAmount);
    await supabase.from('players').update({ paid: newPaidTotal }).eq('id', player.id);
    setPaymentAmount('');
    setSelectedPlayerForPayment(null);
    fetchAllData();
  };

  // HELPERS
  const calculatePlayerShare = (playerId) => {
    let totalShare = 0;
    events.forEach(event => {
      const attendees = typeof event.attendees === 'string' ? JSON.parse(event.attendees) : event.attendees;
      if (attendees && attendees.includes(playerId)) totalShare += event.cost / attendees.length;
    });
    gearOrders.forEach(order => {
      const items = typeof order.line_items === 'string' ? JSON.parse(order.line_items) : order.line_items;
      items?.forEach(item => {
        if (item.purchasers?.includes(playerId)) totalShare += item.cost / item.purchasers.length;
      });
    });
    return totalShare;
  };

  const toggleAttendee = (id) => {
    const current = newEvent.attendees;
    setNewEvent({ ...newEvent, attendees: current.includes(id) ? current.filter(x => x !== id) : [...current, id] });
  };
  const toggleAllAttendees = () => setNewEvent({...newEvent, attendees: newEvent.attendees.length === players.length ? [] : players.map(p => p.id)});
  const toggleLinePurchaser = (id) => {
    const current = newLineItem.purchasers;
    setNewLineItem({ ...newLineItem, purchasers: current.includes(id) ? current.filter(x => x !== id) : [...current, id] });
  };
  const toggleLineAll = () => setNewLineItem({...newLineItem, purchasers: newLineItem.purchasers.length === players.length ? [] : players.map(p => p.id)});
  const addLineItemToStaging = () => {
    if (!newLineItem.description || !newLineItem.cost || newLineItem.purchasers.length === 0) return;
    setCurrentOrderItems([...currentOrderItems, { ...newLineItem, id: Date.now(), cost: parseFloat(newLineItem.cost) }]);
    setNewLineItem({ description: '', cost: '', purchasers: [] });
  };

  // RENDER: MISSING CONFIG
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl text-center">
          <Target className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Configuration Issue</h2>
          <p className="text-slate-600 mb-4">The app cannot read your Supabase keys.</p>
          <div className="bg-yellow-50 p-4 rounded text-left text-sm font-mono text-slate-700 mb-6 border border-yellow-200">
            <strong>Check Netlify Settings:</strong><br/>
            1. Key: <code>VITE_SUPABASE_URL</code><br/>
            2. Key: <code>VITE_SUPABASE_ANON_KEY</code><br/>
            3. Trigger a <b>new deploy</b> after saving!
          </div>
        </div>
      </div>
    );
  }

  if (!isSupabaseLibraryLoaded) return <div className="p-10 text-center">Loading...</div>;

  // --- RENDER: LOGIN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-sm w-full shadow-2xl">
          <div className="text-center mb-6">
             <Target className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
             <h1 className="text-2xl font-bold text-slate-800">Team Portal</h1>
          </div>
          {authError && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{authError}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Email</label>
              <input type="email" required className="w-full p-2 border rounded bg-slate-50" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Password</label>
              <input type="password" required className="w-full p-2 border rounded bg-slate-50" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded font-bold hover:bg-slate-800">
              {isLoginView ? "Sign In" : "Create Account"}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => setIsLoginView(!isLoginView)} className="text-sm text-emerald-600 hover:underline">
               {isLoginView ? "Need to create a password? Sign Up" : "Back to Sign In"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: ACCESS DENIED ---
  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow text-center max-w-md">
           <AlertTriangle className="w-12 h-12 text-orange-500 mx-auto mb-4"/>
           <h2 className="text-xl font-bold text-slate-800 mb-2">Access Pending</h2>
           <p className="text-slate-600 mb-6">
             You are logged in as <strong>{session.user.email}</strong>, but this email is not on the team roster yet.
           </p>
           <div className="bg-slate-50 p-4 rounded text-sm text-slate-500 mb-6">
             Ask your Admin to add <b>{session.user.email}</b> to the Roster. Once added, refresh this page.
           </div>
           <button onClick={handleLogout} className="text-emerald-600 font-bold hover:underline">Sign Out</button>
        </div>
      </div>
    );
  }

  // --- RENDER: MAIN APP ---
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto pb-10">
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 rounded-b-2xl shadow-lg mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
               <Target className="w-8 h-8 mr-3 text-emerald-400"/>
               <div>
                 <h1 className="text-xl font-extrabold">Splat<span className="text-emerald-400">Tracker</span></h1>
                 <div className="flex items-center gap-2">
                    <p className="text-xs text-slate-400">{session.user.email}</p>
                    {isAdmin ? 
                      <span className="text-[10px] bg-emerald-500 text-emerald-900 px-2 rounded-full font-bold">ADMIN</span> : 
                      <span className="text-[10px] bg-slate-700 text-slate-300 px-2 rounded-full">VIEW ONLY</span>
                    }
                 </div>
               </div>
            </div>
            <button onClick={handleLogout} className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded text-sm flex items-center"><LogOut className="w-4 h-4 mr-2" /> Sign Out</button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex space-x-2 px-4 mb-6 overflow-x-auto">
          {['dashboard', 'events', 'gear', 'roster'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[90px] py-3 rounded-lg font-bold capitalize ${activeTab === tab ? 'bg-white shadow-md text-emerald-600 border-t-4 border-emerald-500' : 'bg-slate-200 text-slate-500'}`}>
              {tab}
            </button>
          ))}
        </div>

        <div className="px-4">
          
          {/* --- DASHBOARD --- */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                   { label: "Expenses", val: events.reduce((a,c)=>a+c.cost,0) + gearOrders.reduce((a,o)=>{const i = typeof o.line_items==='string'?JSON.parse(o.line_items):o.line_items; return a+(i?.reduce((s,li)=>s+li.cost,0)||0)},0), color: "border-blue-500" },
                   { label: "Collected", val: players.reduce((a,c)=>a+(c.paid||0),0), color: "border-emerald-500" },
                   { label: "Outstanding", val: 0, color: "border-red-500" }
                ].map((stat, i) => {
                  const totalExp = events.reduce((a,c)=>a+c.cost,0) + gearOrders.reduce((a,o)=>{const items = typeof o.line_items==='string'?JSON.parse(o.line_items):o.line_items; return a+(items?.reduce((s,li)=>s+li.cost,0)||0)},0);
                  const collected = players.reduce((a,c)=>a+(c.paid||0),0);
                  const displayVal = i === 2 ? totalExp - collected : stat.val;
                  return (
                   <div key={i} className={`p-4 rounded-lg shadow bg-white border-l-4 ${stat.color}`}>
                     <p className="text-gray-500 text-xs font-bold uppercase">{stat.label}</p>
                     <p className="text-2xl font-bold">${displayVal.toFixed(2)}</p>
                   </div>
                  )
                })}
              </div>

              {isAdmin && (
                <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
                  <h3 className="font-bold text-slate-700 mb-3 flex items-center"><DollarSign className="w-4 h-4 mr-2"/> Record Payment</h3>
                  <form onSubmit={recordPayment} className="flex gap-3">
                    <select className="p-2 border rounded flex-1" value={selectedPlayerForPayment || ''} onChange={e => setSelectedPlayerForPayment(e.target.value)} required>
                      <option value="">Select Player...</option>
                      {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" placeholder="$" className="p-2 border rounded w-24" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} step="0.01" required />
                    <button type="submit" className="bg-emerald-600 text-white px-4 rounded font-bold hover:bg-emerald-700">Save</button>
                  </form>
                </div>
              )}

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-800 text-white">
                    <tr><th className="p-4">Player</th><th className="p-4 text-right">Owes</th><th className="p-4 text-right">Paid</th><th className="p-4 text-right">Balance</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {players.map(p => {
                      const share = calculatePlayerShare(p.id);
                      const bal = share - (p.paid || 0);
                      return (
                        <tr key={p.id}>
                          <td className="p-4 font-medium">
                            {p.name}
                            {p.is_admin && <Shield className="w-3 h-3 inline ml-1 text-emerald-500"/>}
                          </td>
                          <td className="p-4 text-right font-medium">${share.toFixed(2)}</td>
                          <td className="p-4 text-right text-emerald-600">${(p.paid||0).toFixed(2)}</td>
                          <td className="p-4 text-right"><span className={`px-2 py-1 rounded text-xs font-bold ${bal > 0.01 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{bal > 0.01 ? `Owes $${bal.toFixed(2)}` : 'Paid'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- EVENTS --- */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              {isAdmin && (
                <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
                  <h2 className="font-bold text-lg mb-4">Log Event</h2>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <select className="border p-2 rounded" value={newEvent.type} onChange={e=>setNewEvent({...newEvent, type: e.target.value})}>
                      <option>Practice</option><option>Tournament</option><option>Social</option>
                    </select>
                    <input type="date" className="border p-2 rounded" value={newEvent.date} onChange={e=>setNewEvent({...newEvent, date: e.target.value})} />
                    <input type="number" className="border p-2 rounded" placeholder="Total Cost" value={newEvent.cost} onChange={e=>setNewEvent({...newEvent, cost: e.target.value})} />
                  </div>
                  <div className="mb-4">
                    <div className="flex justify-between mb-2"><span className="text-sm font-bold text-slate-500">Attendees</span> <button onClick={toggleAllAttendees} className="text-xs text-blue-600">All/None</button></div>
                    <div className="flex flex-wrap gap-2">
                      {players.map(p => (
                        <button key={p.id} onClick={()=>toggleAttendee(p.id)} className={`px-3 py-1 rounded text-xs font-bold border ${newEvent.attendees.includes(p.id) ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-slate-50 border-slate-200'}`}>{p.name}</button>
                      ))}
                    </div>
                  </div>
                  <button onClick={submitEvent} className="w-full bg-slate-800 text-white py-3 rounded font-bold hover:bg-slate-700">Save Event</button>
                </div>
              )}
              <div className="bg-white rounded-lg shadow divide-y">
                 {events.map(e => (
                   <div key={e.id} className="p-4 flex justify-between items-center">
                     <div><span className="font-bold text-slate-700">{e.date}</span> <span className="text-xs uppercase bg-slate-100 px-2 rounded">{e.type}</span> <div className="text-sm text-slate-500">${e.cost} split by {(typeof e.attendees === 'string' ? JSON.parse(e.attendees) : e.attendees).length}</div></div>
                     {isAdmin && <button onClick={()=>deleteEvent(e.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>}
                   </div>
                 ))}
                 {events.length === 0 && <div className="p-6 text-center text-gray-400">No events logged.</div>}
              </div>
            </div>
          )}

          {/* --- GEAR --- */}
          {activeTab === 'gear' && (
            <div className="space-y-6">
               {isAdmin && (
                 <div className="bg-white rounded-lg shadow overflow-hidden border-l-4 border-orange-500">
                    <div className="bg-slate-50 p-4 font-bold text-slate-700 border-b">New Gear Order</div>
                    <div className="p-4 space-y-4">
                       <div className="grid grid-cols-2 gap-3">
                         <input type="text" className="border p-2 rounded" placeholder="Order Desc (e.g. PE Order)" value={newOrderMeta.description} onChange={e=>setNewOrderMeta({...newOrderMeta, description: e.target.value})} />
                         <input type="date" className="border p-2 rounded" value={newOrderMeta.date} onChange={e=>setNewOrderMeta({...newOrderMeta, date: e.target.value})} />
                       </div>
                       <div className="bg-slate-50 p-3 rounded border">
                          <div className="flex gap-2 mb-2">
                             <input type="text" className="border p-2 rounded flex-[2]" placeholder="Item Name" value={newLineItem.description} onChange={e=>setNewLineItem({...newLineItem, description: e.target.value})} />
                             <input type="number" className="border p-2 rounded flex-1" placeholder="Cost" value={newLineItem.cost} onChange={e=>setNewLineItem({...newLineItem, cost: e.target.value})} />
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                             {players.map(p => (
                               <button key={p.id} onClick={()=>toggleLinePurchaser(p.id)} className={`px-2 py-1 text-xs border rounded ${newLineItem.purchasers.includes(p.id) ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white'}`}>{p.name}</button>
                             ))}
                             <button onClick={toggleLineAll} className="text-xs text-blue-500 underline ml-auto">All</button>
                          </div>
                          <button onClick={addLineItemToStaging} className="w-full bg-white border border-slate-300 py-1 rounded text-sm font-bold text-slate-600">+ Add Item</button>
                       </div>
                       {currentOrderItems.length > 0 && (
                         <div className="text-sm space-y-1 border-t pt-2">
                           {currentOrderItems.map(i => <div key={i.id} className="flex justify-between"><span>{i.description}</span> <span>${i.cost}</span></div>)}
                         </div>
                       )}
                       <button onClick={submitFullOrder} className="w-full bg-emerald-600 text-white py-3 rounded font-bold hover:bg-emerald-700">Save Full Order</button>
                    </div>
                 </div>
               )}
               <div className="space-y-3">
                 {gearOrders.map(o => {
                   const items = typeof o.line_items === 'string' ? JSON.parse(o.line_items) : o.line_items;
                   return (
                   <div key={o.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                      <div><div className="font-bold">{o.description}</div><div className="text-xs text-slate-500">{o.date} • {items?.length} Items</div></div>
                      <div className="text-right">
                        <div className="font-bold text-lg">${items?.reduce((a,b)=>a+b.cost,0).toFixed(2)}</div>
                        {isAdmin && <button onClick={()=>deleteOrder(o.id)} className="text-xs text-red-400">Remove</button>}
                      </div>
                   </div>
                 )})}
               </div>
            </div>
          )}

          {/* --- ROSTER (ADMIN MANAGES USERS) --- */}
          {activeTab === 'roster' && (
            <div className="space-y-6">
              {isAdmin && (
                <div className="bg-white p-6 rounded shadow max-w-xl mx-auto border-l-4 border-purple-500">
                   <h2 className="font-bold mb-4 flex items-center"><UserPlus className="w-5 h-5 mr-2"/> Add Teammate</h2>
                   <form onSubmit={addToRoster} className="space-y-3">
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase">Player Name</label>
                       <input className="w-full border p-2 rounded" placeholder="e.g. Viper" value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)}/>
                     </div>
                     <div>
                       <label className="block text-xs font-bold text-slate-500 uppercase">Email (For Login)</label>
                       <input type="email" className="w-full border p-2 rounded" placeholder="player@team.com" value={newPlayerEmail} onChange={e=>setNewPlayerEmail(e.target.value)}/>
                     </div>
                     <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border">
                       <input type="checkbox" id="isAdmin" checked={makeAdmin} onChange={e => setMakeAdmin(e.target.checked)} />
                       <label htmlFor="isAdmin" className="text-sm font-bold text-slate-700">Grant Admin Access?</label>
                     </div>
                     <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded font-bold">Add & Invite</button>
                   </form>
                </div>
              )}

               <div className="bg-white rounded shadow max-w-xl mx-auto overflow-hidden">
                 <div className="bg-slate-100 p-4 font-bold text-slate-600">Current Team</div>
                 <div className="divide-y">
                   {players.map(p => (
                     <div key={p.id} className="flex justify-between items-center p-4 hover:bg-slate-50">
                       <div>
                         <div className="font-bold text-slate-800 flex items-center">
                           {p.name}
                           {p.is_admin && <Shield className="w-3 h-3 ml-2 text-emerald-500" />}
                         </div>
                         <div className="text-xs text-slate-400">{p.email || "No email linked"}</div>
                       </div>
                       <div className="flex items-center gap-3">
                         {isAdmin && p.email && (
                           <a 
                             href={`mailto:${p.email}?subject=Join Paintball Finance Tracker&body=Hey ${p.name}, sign up here: ${window.location.href}`}
                             className="text-blue-400 hover:text-blue-600"
                             title="Send Email Invite"
                           >
                             <Mail className="w-4 h-4" />
                           </a>
                         )}
                         {isAdmin && <button onClick={()=>deletePlayer(p.id)} className="text-red-300 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>}
                       </div>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
