import React, { useState, useEffect } from 'react';
import { Users, Calendar, DollarSign, Plus, Trash2, Save, Target, Shield, CheckCircle, ShoppingBag, ListPlus, X, LogOut, Lock } from 'lucide-react';

// --- CONFIGURATION ---
// 1. Go to https://supabase.com/dashboard
// 2. Create a new project
// 3. Go to Project Settings -> API
// 4. Copy the URL and the "anon" / "public" Key
const supabaseUrl = "https://dpdhgtngzmynyergynhu.supabase.co";
const supabaseKey = "sb_secret_fixHvTF4rLFaS5ngctVTNw_F8nbJ1i6";

const isConfigured = supabaseUrl !== "https://dpdhgtngzmynyergynhu.supabase.co";

export default function PaintballFinanceTracker() {
  // --- State Management ---
  // Supabase Client State (Initialized dynamically to avoid bundler errors)
  const [supabase, setSupabase] = useState(null);
  const [isSupabaseLibraryLoaded, setIsSupabaseLibraryLoaded] = useState(false);

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Data States
  const [players, setPlayers] = useState([]);
  const [events, setEvents] = useState([]);
  const [gearOrders, setGearOrders] = useState([]);

  // --- Auth Forms State ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginView, setIsLoginView] = useState(true);
  const [authError, setAuthError] = useState('');

  // --- Form States ---
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newEvent, setNewEvent] = useState({ type: 'Practice', date: '', cost: '', attendees: [] });
  const [newOrderMeta, setNewOrderMeta] = useState({ description: '', date: '' });
  const [newLineItem, setNewLineItem] = useState({ description: '', cost: '', purchasers: [] });
  const [currentOrderItems, setCurrentOrderItems] = useState([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [selectedPlayerForPayment, setSelectedPlayerForPayment] = useState(null);

  // --- 1. DYNAMIC SCRIPT LOADING ---
  // We load Supabase via script tag to avoid "Dynamic Require" errors in the preview environment
  useEffect(() => {
    if (!isConfigured) return;

    // If already loaded (e.g. hot reload), init immediately
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

  // --- 2. INITIALIZATION ---
  useEffect(() => {
    if (!supabase) return;

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) fetchAllData();
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAllData();
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  // --- DATA FETCHING ---
  const fetchAllData = async () => {
    if (!supabase) return;
    
    // Fetch Players
    const { data: playersData } = await supabase.from('players').select('*').order('name');
    if (playersData) setPlayers(playersData);

    // Fetch Events
    const { data: eventsData } = await supabase.from('events').select('*').order('date', { ascending: false });
    if (eventsData) setEvents(eventsData);

    // Fetch Gear
    const { data: gearData } = await supabase.from('gear_orders').select('*').order('date', { ascending: false });
    if (gearData) setGearOrders(gearData);
  };

  // --- AUTH ACTIONS ---
  const handleAuth = async (e) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthError('');
    try {
      if (isLoginView) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Check your email for the confirmation link!");
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setPlayers([]);
    setEvents([]);
    setGearOrders([]);
  };

  // --- DATABASE ACTIONS ---

  const addPlayer = async () => {
    if (!newPlayerName.trim() || !supabase) return;
    const { error } = await supabase.from('players').insert([{ name: newPlayerName, paid: 0 }]);
    if (!error) {
      setNewPlayerName('');
      fetchAllData();
    }
  };

  const deletePlayer = async (id) => {
    if (!supabase || !window.confirm("Delete player?")) return;
    await supabase.from('players').delete().eq('id', id);
    fetchAllData();
  };

  const submitEvent = async () => {
    if (!newEvent.date || !newEvent.cost || newEvent.attendees.length === 0) {
      alert("Fill all fields and select attendees.");
      return;
    }
    if (!supabase) return;

    const { error } = await supabase.from('events').insert([{
      type: newEvent.type,
      date: newEvent.date,
      cost: parseFloat(newEvent.cost),
      attendees: newEvent.attendees // stored as JSONB
    }]);
    
    if (!error) {
      setNewEvent({ type: 'Practice', date: '', cost: '', attendees: [] });
      setActiveTab('dashboard');
      fetchAllData();
    }
  };

  const deleteEvent = async (id) => {
    if (!supabase || !window.confirm("Delete this event?")) return;
    await supabase.from('events').delete().eq('id', id);
    fetchAllData();
  };

  const submitFullOrder = async () => {
    if (!newOrderMeta.date || !newOrderMeta.description || currentOrderItems.length === 0) {
      alert("Missing details or items.");
      return;
    }
    if (!supabase) return;

    const { error } = await supabase.from('gear_orders').insert([{
      description: newOrderMeta.description,
      date: newOrderMeta.date,
      line_items: currentOrderItems // stored as JSONB
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
    if (!supabase || !window.confirm("Delete this order?")) return;
    await supabase.from('gear_orders').delete().eq('id', id);
    fetchAllData();
  };

  const recordPayment = async (e) => {
    e.preventDefault();
    if (!selectedPlayerForPayment || !paymentAmount || !supabase) return;
    
    const player = players.find(p => p.id === parseInt(selectedPlayerForPayment));
    if (!player) return;

    const newPaidTotal = (player.paid || 0) + parseFloat(paymentAmount);
    
    const { error } = await supabase.from('players').update({ paid: newPaidTotal }).eq('id', player.id);
    
    if (!error) {
      setPaymentAmount('');
      setSelectedPlayerForPayment(null);
      fetchAllData();
    }
  };

  // --- LOGIC HELPERS ---
  const calculatePlayerShare = (playerId) => {
    let totalShare = 0;
    events.forEach(event => {
      const attendees = typeof event.attendees === 'string' ? JSON.parse(event.attendees) : event.attendees;
      if (attendees && attendees.includes(playerId)) {
        totalShare += event.cost / attendees.length;
      }
    });
    gearOrders.forEach(order => {
      const items = typeof order.line_items === 'string' ? JSON.parse(order.line_items) : order.line_items;
      items?.forEach(item => {
        if (item.purchasers?.includes(playerId)) {
          totalShare += item.cost / item.purchasers.length;
        }
      });
    });
    return totalShare;
  };

  // --- LOCAL UI HELPERS ---
  const toggleAttendee = (id) => {
    const current = newEvent.attendees;
    setNewEvent({ ...newEvent, attendees: current.includes(id) ? current.filter(x => x !== id) : [...current, id] });
  };
  const toggleAllAttendees = () => {
    setNewEvent({...newEvent, attendees: newEvent.attendees.length === players.length ? [] : players.map(p => p.id)});
  };
  const toggleLinePurchaser = (id) => {
    const current = newLineItem.purchasers;
    setNewLineItem({ ...newLineItem, purchasers: current.includes(id) ? current.filter(x => x !== id) : [...current, id] });
  };
  const toggleLineAll = () => {
    setNewLineItem({...newLineItem, purchasers: newLineItem.purchasers.length === players.length ? [] : players.map(p => p.id)});
  };
  const addLineItemToStaging = () => {
    if (!newLineItem.description || !newLineItem.cost || newLineItem.purchasers.length === 0) return;
    setCurrentOrderItems([...currentOrderItems, { ...newLineItem, id: Date.now(), cost: parseFloat(newLineItem.cost) }]);
    setNewLineItem({ description: '', cost: '', purchasers: [] });
  };

  // --- RENDER: SETUP ---
  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl text-center">
          <Target className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Supabase Setup</h2>
          <p className="text-slate-600 mb-6">Connect your project to store team data securely.</p>
          <div className="bg-slate-100 p-4 rounded text-left text-sm font-mono text-slate-700 mb-6 overflow-x-auto">
            1. Create project at supabase.com<br/>
            2. Paste API URL & Key in code (line 10)<br/>
            3. Run the SQL script in the guide to create tables.
          </div>
          <p className="text-xs text-slate-400">See Hosting Guide for SQL script.</p>
        </div>
      </div>
    );
  }

  // --- RENDER: LOADING LIBRARY ---
  if (!isSupabaseLibraryLoaded) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-500 animate-pulse font-bold">Connecting to Supabase...</div>
      </div>
    );
  }

  // --- RENDER: AUTH ---
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 max-w-sm w-full shadow-xl">
          <div className="text-center mb-6">
             <Target className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
             <h1 className="text-2xl font-bold text-slate-800">Team Login</h1>
          </div>
          {authError && <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-sm">{authError}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            <input type="email" required className="w-full p-2 border rounded" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <input type="password" required className="w-full p-2 border rounded" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
            <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded font-bold hover:bg-slate-800">{isLoginView ? "Sign In" : "Sign Up"}</button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => setIsLoginView(!isLoginView)} className="text-sm text-emerald-600 hover:underline">{isLoginView ? "Create Account" : "Back to Login"}</button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: DASHBOARD ---
  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto pb-10">
        <div className="bg-slate-900 text-white p-6 rounded-b-2xl shadow-lg mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
               <Target className="w-8 h-8 mr-3 text-emerald-400"/>
               <div><h1 className="text-xl font-extrabold">Splat<span className="text-emerald-400">Tracker</span></h1><p className="text-xs text-slate-400">{session.user.email}</p></div>
            </div>
            <button onClick={handleLogout} className="bg-slate-800 px-3 py-2 rounded text-sm flex items-center"><LogOut className="w-4 h-4 mr-2" /> Sign Out</button>
          </div>
        </div>

        <div className="flex space-x-2 px-4 mb-6 overflow-x-auto">
          {['dashboard', 'events', 'gear', 'roster'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-1 min-w-[90px] py-3 rounded-lg font-bold capitalize ${activeTab === tab ? 'bg-white shadow-md text-emerald-600 border-t-4 border-emerald-500' : 'bg-slate-200 text-slate-500'}`}>{tab}</button>
          ))}
        </div>

        <div className="px-4">
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                   { label: "Expenses", val: events.reduce((a,c)=>a+c.cost,0) + gearOrders.reduce((a,o)=>{const i = typeof o.line_items==='string'?JSON.parse(o.line_items):o.line_items; return a+(i?.reduce((s,li)=>s+li.cost,0)||0)},0), color: "border-blue-500" },
                   { label: "Collected", val: players.reduce((a,c)=>a+(c.paid||0),0), color: "border-emerald-500" },
                   { label: "Outstanding", val: 0, color: "border-red-500" } // calculated below
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

              <div className="bg-white p-4 rounded-lg shadow border border-slate-200">
                <h3 className="font-bold text-slate-700 mb-3 flex items-center"><DollarSign className="w-4 h-4 mr-2"/> Record Payment</h3>
                <form onSubmit={recordPayment} className="flex gap-3">
                  <select className="p-2 border rounded flex-1" value={selectedPlayerForPayment || ''} onChange={e => setSelectedPlayerForPayment(e.target.value)} required>
                    <option value="">Select Player...</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="number" placeholder="$" className="p-2 border rounded w-24" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} step="0.01" required />
                  <button type="submit" className="bg-emerald-600 text-white px-4 rounded font-bold">Save</button>
                </form>
              </div>

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
                          <td className="p-4 font-medium">{p.name}</td>
                          <td className="p-4 text-right font-medium">${share.toFixed(2)}</td>
                          <td className="p-4 text-right text-emerald-600">${(p.paid||0).toFixed(2)}</td>
                          <td className="p-4 text-right"><span className={`px-2 py-1 rounded text-xs font-bold ${bal > 0.01 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{bal > 0.01 ? `Owes $${bal.toFixed(2)}` : 'Paid'}</span></td>
                        </tr>
                      );
                    })}
                    {players.length === 0 && <tr><td colSpan="4" className="p-6 text-center text-gray-400">No players found.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'events' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-lg shadow">
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
                <button onClick={submitEvent} className="w-full bg-slate-800 text-white py-3 rounded font-bold">Save Event</button>
              </div>
              <div className="bg-white rounded-lg shadow divide-y">
                 {events.map(e => (
                   <div key={e.id} className="p-4 flex justify-between items-center">
                     <div><span className="font-bold text-slate-700">{e.date}</span> <span className="text-xs uppercase bg-slate-100 px-2 rounded">{e.type}</span> <div className="text-sm text-slate-500">${e.cost} split by {(typeof e.attendees === 'string' ? JSON.parse(e.attendees) : e.attendees).length}</div></div>
                     <button onClick={()=>deleteEvent(e.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                   </div>
                 ))}
              </div>
            </div>
          )}

          {activeTab === 'gear' && (
            <div className="space-y-6">
               <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-slate-800 p-4 text-white font-bold">New Gear Order</div>
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
                     <button onClick={submitFullOrder} className="w-full bg-emerald-600 text-white py-3 rounded font-bold">Save Full Order</button>
                  </div>
               </div>
               <div className="space-y-3">
                 {gearOrders.map(o => {
                   const items = typeof o.line_items === 'string' ? JSON.parse(o.line_items) : o.line_items;
                   return (
                   <div key={o.id} className="bg-white p-4 rounded shadow flex justify-between items-center">
                      <div><div className="font-bold">{o.description}</div><div className="text-xs text-slate-500">{o.date} • {items?.length} Items</div></div>
                      <div className="text-right">
                        <div className="font-bold text-lg">${items?.reduce((a,b)=>a+b.cost,0).toFixed(2)}</div>
                        <button onClick={()=>deleteOrder(o.id)} className="text-xs text-red-400">Remove</button>
                      </div>
                   </div>
                 )})}
               </div>
            </div>
          )}

          {activeTab === 'roster' && (
            <div className="bg-white p-6 rounded shadow max-w-lg mx-auto">
               <h2 className="font-bold mb-4">Roster</h2>
               <div className="flex gap-2 mb-4">
                 <input className="border p-2 rounded flex-1" placeholder="New Player Name" value={newPlayerName} onChange={e=>setNewPlayerName(e.target.value)}/>
                 <button onClick={addPlayer} className="bg-slate-800 text-white px-4 rounded"><Plus/></button>
               </div>
               <div className="space-y-2">
                 {players.map(p => (
                   <div key={p.id} className="flex justify-between border p-3 rounded bg-slate-50">
                     <span>{p.name}</span>
                     <button onClick={()=>deletePlayer(p.id)} className="text-red-300 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>
                   </div>
                 ))}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
