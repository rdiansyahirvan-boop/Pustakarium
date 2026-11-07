import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
  StyleSheet, SafeAreaView, Platform, StatusBar as RNStatusBar, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------- Sumber buku legal & gratis ----------
const gutenberg = async (q, lang) => {
  const p = new URLSearchParams(q ? { search: q } : { sort: 'popular' });
  if (lang) p.set('languages', lang);
  const r = await (await fetch('https://gutendex.com/books?' + p)).json();
  return r.results.map(b => ({
    key: 'g' + b.id, src: 'Project Gutenberg', title: b.title,
    author: b.authors[0]?.name || 'Anonim', cover: b.formats['image/jpeg'],
    url: b.formats['text/html'] || b.formats['text/html; charset=utf-8'] || `https://www.gutenberg.org/ebooks/${b.id}.html.images`,
    gutenberg: true,
  }));
};
const archive = async (q, lang) => {
  const query = `(${q || 'subject:literature'})${lang ? ` AND language:${lang}` : ''} AND mediatype:texts AND access-restricted-item:false`;
  const u = 'https://archive.org/advancedsearch.php?output=json&rows=30&sort[]=downloads desc&fl[]=identifier&fl[]=title&fl[]=creator&q=' + encodeURIComponent(query);
  const r = await (await fetch(u)).json();
  return r.response.docs.map(d => ({
    key: 'a' + d.identifier, src: 'Internet Archive', title: d.title,
    author: [].concat(d.creator || 'Anonim')[0],
    cover: `https://archive.org/services/img/${d.identifier}`,
    url: `https://archive.org/embed/${d.identifier}`,
  }));
};
const searchAll = async (q, lang) => {
  const res = await Promise.allSettled([gutenberg(q, lang), archive(q, lang)]);
  const a = res[0].value || [], b = res[1].value || [];
  const out = []; for (let i = 0; i < Math.max(a.length, b.length); i++) { if (a[i]) out.push(a[i]); if (b[i]) out.push(b[i]); }
  return out;
};

const LANGS = [['Semua', ''], ['Indonesia', 'id'], ['English', 'en']];
const CATS = ['Fiksi', 'Sejarah', 'Filsafat', 'Sains', 'Puisi', 'Petualangan', 'Anak-anak', 'Biografi'];
const CAT_Q = { Fiksi: 'fiction', Sejarah: 'history', Filsafat: 'philosophy', Sains: 'science', Puisi: 'poetry',
  Petualangan: 'adventure', 'Anak-anak': 'children', Biografi: 'biography' };

export default function App() {
  const dark = useColorScheme() === 'dark';
  const c = dark ? { bg: '#0f1115', card: '#1a1d24', tx: '#f2f2f2', sub: '#9aa0aa', ac: '#7c9cff' }
                 : { bg: '#f6f4ef', card: '#ffffff', tx: '#1b1b1f', sub: '#6b6f78', ac: '#3b5bdb' };
  const s = makeStyles(c);
  const [tab, setTab] = useState('home');
  const [book, setBook] = useState(null);
  const [shelf, setShelf] = useState([]);
  const [lang, setLang] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { AsyncStorage.getItem('shelf').then(v => v && setShelf(JSON.parse(v))).catch(() => {}); }, []);
  const toggleShelf = b => {
    const n = shelf.some(x => x.key === b.key) ? shelf.filter(x => x.key !== b.key) : [b, ...shelf];
    setShelf(n); AsyncStorage.setItem('shelf', JSON.stringify(n)).catch(() => {});
  };
  const run = useCallback(async (query) => {
    setLoading(true);
    try { setItems(await searchAll(query, lang)); } catch { setItems([]); }
    setLoading(false);
  }, [lang]);
  useEffect(() => { run(tab === 'search' ? q : ''); }, [lang, tab === 'home']);

  const Card = ({ b }) => (
    <TouchableOpacity style={s.card} onPress={() => setBook(b)}>
      <Image source={{ uri: b.cover }} style={s.cover} />
      <View style={{ flex: 1, padding: 10 }}>
        <Text style={s.title} numberOfLines={3}>{b.title}</Text>
        <Text style={s.sub} numberOfLines={1}>{b.author}</Text>
        <Text style={[s.sub, { color: c.ac, marginTop: 4 }]}>{b.src}</Text>
      </View>
      <TouchableOpacity onPress={() => toggleShelf(b)} style={{ padding: 12 }}>
        <Text style={{ fontSize: 22, color: c.ac }}>{shelf.some(x => x.key === b.key) ? '★' : '☆'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (book) return <Reader book={book} c={c} dark={dark} onBack={() => setBook(null)} />;

  const data = tab === 'shelf' ? shelf : items;
  return (
    <SafeAreaView style={s.root}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Text style={s.h1}>{tab === 'home' ? 'Pustaka' : tab === 'search' ? 'Cari Buku' : 'Rak Saya'}</Text>
      {tab === 'search' && (
        <TextInput style={s.input} placeholder="Judul, penulis, topik…" placeholderTextColor={c.sub}
          value={q} onChangeText={setQ} returnKeyType="search" onSubmitEditing={() => run(q)} />
      )}
      {tab !== 'shelf' && (
        <View style={s.row}>
          {LANGS.map(([n, v]) => (
            <TouchableOpacity key={n} onPress={() => setLang(v)} style={[s.chip, lang === v && { backgroundColor: c.ac }]}>
              <Text style={{ color: lang === v ? '#fff' : c.tx }}>{n}</Text>
            </TouchableOpacity>))}
        </View>)}
      {tab === 'home' && (
        <FlatList horizontal data={CATS} showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16 }} keyExtractor={x => x}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.chip} onPress={() => { setQ(CAT_Q[item]); setTab('search'); run(CAT_Q[item]); }}>
              <Text style={{ color: c.tx }}>{item}</Text></TouchableOpacity>)} />)}
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={c.ac} /> : (
        <FlatList data={data} keyExtractor={b => b.key} renderItem={({ item }) => <Card b={item} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
          ListEmptyComponent={<Text style={[s.sub, { textAlign: 'center', marginTop: 40 }]}>
            {tab === 'shelf' ? 'Belum ada buku. Ketuk ☆ untuk menyimpan.' : 'Tidak ada hasil.'}</Text>} />)}
      <View style={s.tabs}>
        {[['home', '🏠', 'Beranda'], ['search', '🔍', 'Cari'], ['shelf', '📚', 'Rak']].map(([k, i, n]) => (
          <TouchableOpacity key={k} style={s.tab} onPress={() => setTab(k)}>
            <Text style={{ fontSize: 20 }}>{i}</Text>
            <Text style={{ color: tab === k ? c.ac : c.sub, fontSize: 12 }}>{n}</Text>
          </TouchableOpacity>))}
      </View>
    </SafeAreaView>
  );
}

function Reader({ book, c, dark, onBack }) {
  const [size, setSize] = useState(110);
  const [night, setNight] = useState(dark);
  const css = book.gutenberg
    ? `(function(){var b=document.body;b.style.fontSize='${size}%';b.style.lineHeight='1.6';b.style.maxWidth='42em';b.style.margin='0 auto';b.style.padding='12px';
       b.style.background='${night ? '#111' : '#fbf8f1'}';b.style.color='${night ? '#ddd' : '#222'}';})();true;` : 'true;';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10 }}>
        <TouchableOpacity onPress={onBack}><Text style={{ color: c.ac, fontSize: 16 }}>‹ Kembali</Text></TouchableOpacity>
        <Text numberOfLines={1} style={{ flex: 1, color: c.tx, textAlign: 'center', fontWeight: '600', marginHorizontal: 8 }}>{book.title}</Text>
        {book.gutenberg && (<>
          <TouchableOpacity onPress={() => setSize(s => Math.max(70, s - 10))}><Text style={{ color: c.tx, fontSize: 14, padding: 6 }}>A-</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setSize(s => Math.min(220, s + 10))}><Text style={{ color: c.tx, fontSize: 20, padding: 6 }}>A+</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setNight(n => !n)}><Text style={{ fontSize: 18, padding: 6 }}>{night ? '☀️' : '🌙'}</Text></TouchableOpacity>
        </>)}
      </View>
      <WebView key={size + '' + night} source={{ uri: book.url }} injectedJavaScript={css}
        startInLoadingState renderLoading={() => <ActivityIndicator style={StyleSheet.absoluteFill} color={c.ac} />} />
    </SafeAreaView>
  );
}

const makeStyles = c => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0 },
  h1: { fontSize: 30, fontWeight: '800', color: c.tx, paddingHorizontal: 16, paddingTop: 12 },
  input: { margin: 16, marginBottom: 4, padding: 12, borderRadius: 14, backgroundColor: c.card, color: c.tx },
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: c.card, marginRight: 8 },
  card: { flexDirection: 'row', backgroundColor: c.card, borderRadius: 16, marginBottom: 12, overflow: 'hidden', alignItems: 'center' },
  cover: { width: 80, height: 115, backgroundColor: '#8883' },
  title: { color: c.tx, fontWeight: '700', fontSize: 15 },
  sub: { color: c.sub, fontSize: 12, marginTop: 2 },
  tabs: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: c.card, paddingVertical: 8 },
  tab: { flex: 1, alignItems: 'center' },
});
