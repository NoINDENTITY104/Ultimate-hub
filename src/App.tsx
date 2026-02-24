import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShoppingBag, 
  Search, 
  Menu, 
  X, 
  Plus, 
  Minus, 
  ArrowRight, 
  Sparkles, 
  ExternalLink,
  ChevronRight,
  User,
  Heart,
  Settings,
  Package,
  Link as LinkIcon,
  Trash2,
  Eye
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import Markdown from 'react-markdown';
import { cn } from './lib/utils';
import { PRODUCTS as INITIAL_PRODUCTS } from './constants';
import { Product, CartItem } from './types';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  
  // Auth State
  const [user, setUser] = useState<{ name: string; email: string; isOwner: boolean; address?: string } | null>(null);
  const [isOwnerDashboardOpen, setIsOwnerDashboardOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [pendingAction, setPendingAction] = useState<{ type: 'cart' | 'save', product: Product } | null>(null);
  const [roposoUrl, setRoposoUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedQuickViewProduct, setSelectedQuickViewProduct] = useState<Product | null>(null);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isOwner = user?.isOwner || false;

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/user');
      const data = await response.json();
      if (data.authenticated) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error fetching user:", error);
    }
  };

  useEffect(() => {
    fetchUser();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        fetchUser();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleLogin = () => {
    window.open('/auth/google', 'google_oauth', 'width=600,height=700');
  };

  const handleLogout = async () => {
    await fetch('/api/logout');
    setUser(null);
    setIsOwnerDashboardOpen(false);
  };

  const categories = ['All', 'Clothes', 'Watches', 'Shoes', 'Accessories'];
  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'All' || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleAction = (type: 'cart' | 'save', product: Product) => {
    if (!user) {
      setPendingAction({ type, product });
      handleLogin();
      return;
    }

    if (type === 'cart') {
      if (!user.address && !addressInput) {
        setPendingAction({ type, product });
        setIsAddressModalOpen(true);
        return;
      }
      addToCart(product);
    } else {
      toggleWishlist(product);
    }
  };

  const toggleWishlist = (product: Product) => {
    setWishlist(prev => {
      const exists = prev.find(p => p.id === product.id);
      if (exists) {
        return prev.filter(p => p.id !== product.id);
      }
      return [...prev, product];
    });
  };

  const submitAddress = async () => {
    if (!addressInput.trim()) return;
    setUser(prev => prev ? { ...prev, address: addressInput } : null);
    setIsAddressModalOpen(false);
    
    if (pendingAction && pendingAction.type === 'cart') {
      addToCart(pendingAction.product);
      setPendingAction(null);
    }
  };
  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const askAiAssistant = async () => {
    if (!aiInput.trim()) return;
    setIsAiLoading(true);
    setAiMessage('');
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are a high-end fashion stylist for "Ultimate Hub". 
        The user is asking: "${aiInput}". 
        Our current inventory includes: ${products.map(p => `${p.name} ($${p.price})`).join(', ')}.
        Categories: Clothes, Watches, Shoes, Accessories.
        Provide a concise, stylish recommendation. Mention specific products if they fit. 
        Keep it elegant and helpful.`,
      });
      setAiMessage(response.text || "I'm sorry, I couldn't process that request.");
    } catch (error) {
      console.error("AI Error:", error);
      setAiMessage("My apologies, I'm having trouble connecting to my fashion database.");
    } finally {
      setIsAiLoading(false);
      setAiInput('');
    }
  };

  const importFromRoposo = async () => {
    if (!roposoUrl.trim()) return;
    setIsImporting(true);
    
    try {
      // Simulate Roposo scraping/API integration
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `I have a Roposo product URL: ${roposoUrl}. 
        Generate a JSON object for a new product with these fields: name, price (number), category (Clothes, Watches, Shoes, or Accessories), description, image (use a high quality picsum url like https://picsum.photos/seed/[random]/800/1000).
        Make it sound like a premium product. Return ONLY the JSON.`,
        config: { responseMimeType: "application/json" }
      });
      
      const newProductData = JSON.parse(response.text || '{}');
      const newProduct: Product = {
        id: Math.random().toString(36).substr(2, 9),
        ...newProductData,
        cloutLink: roposoUrl
      };
      
      setProducts(prev => [newProduct, ...prev]);
      setRoposoUrl('');
      alert("Product successfully dropped from Roposo!");
    } catch (error) {
      console.error("Import Error:", error);
      alert("Failed to import product. Please check the URL.");
    } finally {
      setIsImporting(false);
    }
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button onClick={() => setIsMenuOpen(true)} className="lg:hidden">
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-serif tracking-tighter italic font-bold select-none">
            ULTIMATE HUB
          </h1>
          <div className="hidden lg:flex items-center gap-8">
            {categories.map(cat => (
              <button 
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "text-xs uppercase tracking-[0.2em] transition-colors hover:text-white",
                  activeCategory === cat ? "text-white" : "text-white/50"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest leading-none">{user.name}</p>
                <p className="text-[8px] text-white/40 uppercase tracking-widest mt-1">{user.isOwner ? 'Owner' : 'Member'}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                title="Logout"
              >
                <User className="w-5 h-5 group-hover:text-red-400 transition-colors" />
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-black hover:bg-emerald-400 transition-all"
            >
              <User className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-bold">Login</span>
            </button>
          )}
          
          {isOwner && (
            <button 
              onClick={() => setIsOwnerDashboardOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
            >
              <Settings className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-bold">Owner Dashboard</span>
            </button>
          )}
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="hidden sm:block text-white/50 hover:text-white transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setIsWishlistOpen(true)}
            className="relative p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <Heart className="w-5 h-5" />
            {wishlist.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 text-black rounded-full text-[10px] flex items-center justify-center font-bold">
                {wishlist.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setIsAiAssistantOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-all border border-white/10"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-widest font-semibold">AI Stylist</span>
          </button>
          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <ShoppingBag className="w-6 h-6" />
            {cart.length > 0 && (
              <span className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 rounded-full text-[10px] flex items-center justify-center font-bold">
                {cart.reduce((a, b) => a + b.quantity, 0)}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden pt-20">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://picsum.photos/seed/ultimate-hero/1920/1080?blur=1" 
            alt="Hero" 
            className="w-full h-full object-cover opacity-50"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050505]/50 to-[#050505]" />
        </div>

        <div className="relative z-10 text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "easeOut" }}
          >
            <span className="text-[10px] uppercase tracking-[0.8em] text-emerald-400 font-bold mb-6 block">
              The Definitive Destination
            </span>
            <h2 className="text-[14vw] lg:text-[12vw] font-serif italic leading-[0.85] tracking-tighter mb-12">
              Ultimate <br /> Hub
            </h2>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
              <button 
                onClick={() => document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' })}
                className="group px-10 py-5 bg-white text-black text-xs uppercase tracking-[0.3em] font-bold hover:bg-emerald-400 transition-all flex items-center gap-3"
              >
                Enter Store <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button 
                onClick={() => document.getElementById('editorial')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-10 py-5 border border-white/20 text-xs uppercase tracking-[0.3em] font-bold hover:bg-white/10 transition-all"
              >
                View Editorial
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Editorial Section */}
      <section id="editorial" className="px-6 py-32 bg-[#050505] border-b border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
          >
            <span className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 font-bold mb-6 block">Featured Designer</span>
            <h3 className="text-6xl font-serif italic mb-8 tracking-tight leading-tight">The Art of <br /> Minimalist Luxury</h3>
            <p className="text-white/50 text-lg leading-relaxed mb-10 font-light">
              "Luxury is not about excess, but about the perfect balance of form and function. Every piece in our collection is a testament to this philosophy."
            </p>
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-full overflow-hidden border border-white/10">
                <img src="https://picsum.photos/seed/designer/200/200" alt="Designer" className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-widest">Elena Vance</p>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">Creative Director</p>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative aspect-[4/5] overflow-hidden rounded-2xl"
          >
            <img 
              src="https://picsum.photos/seed/editorial-1/1000/1250" 
              alt="Editorial" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-10 left-10">
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/60 mb-2">Spring Summer 2026</p>
              <p className="text-2xl font-serif italic">The Obsidian Series</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Product Grid */}
      <section id="shop" className="px-6 py-32 bg-[#050505]">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
            <div>
              <h3 className="text-5xl font-serif italic mb-4 tracking-tight">The Collection</h3>
              <p className="text-white/40 text-sm max-w-lg uppercase tracking-widest leading-relaxed text-[11px]">
                A meticulously curated selection of high-end pieces, bridging the gap between contemporary style and timeless luxury.
              </p>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 md:pb-0">
              {categories.map(cat => (
                <button 
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "whitespace-nowrap px-6 py-3 text-[10px] uppercase tracking-[0.2em] border transition-all",
                    activeCategory === cat ? "border-white bg-white text-black" : "border-white/10 text-white/50 hover:border-white/30"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-24">
            {filteredProducts.map((product, idx) => (
              <motion.div 
                key={product.id}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.8, delay: idx * 0.05 }}
                className="group"
              >
                <div className="relative aspect-[3/4] overflow-hidden mb-8 bg-white/5">
                  <img 
                    src={product.image} 
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center gap-4 backdrop-blur-[2px]">
                    <button 
                      onClick={() => handleAction('cart', product)}
                      className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-emerald-400 transition-all hover:scale-110 active:scale-95"
                      title="Add to Cart"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setSelectedQuickViewProduct(product)}
                      className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-emerald-400 transition-all hover:scale-110 active:scale-95"
                      title="Quick View"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => handleAction('save', product)}
                      className={cn(
                        "w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center transition-all hover:scale-110",
                        wishlist.find(p => p.id === product.id) 
                          ? "bg-emerald-500 text-black" 
                          : "bg-white/10 text-white hover:bg-white/20"
                      )}
                      title="Save to Wishlist"
                    >
                      <Heart className={cn("w-5 h-5", wishlist.find(p => p.id === product.id) && "fill-current")} />
                    </button>
                  </div>
                  {isOwner && product.cloutLink && (
                    <div className="absolute top-6 right-6">
                      <a 
                        href={product.cloutLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-black/60 backdrop-blur-xl border border-white/10 rounded-full text-[9px] uppercase tracking-[0.2em] font-bold flex items-center gap-2 hover:bg-emerald-500 transition-all"
                      >
                        Source <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {isOwner && (
                    <button 
                      onClick={() => deleteProduct(product.id)}
                      className="absolute bottom-6 left-6 p-3 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full hover:bg-red-500 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex justify-between items-start px-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400 font-bold mb-2">{product.category}</p>
                    <h4 className="text-2xl font-serif italic tracking-tight">{product.name}</h4>
                  </div>
                  <p className="font-mono text-lg text-white/80">${product.price}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Section */}
      <section className="px-6 py-32 bg-[#080808] border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <span className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 font-bold mb-6 block">Trending Now</span>
            <h3 className="text-5xl font-serif italic tracking-tight">The Season's Favorites</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: "Monochrome Essentials", img: "https://picsum.photos/seed/trend-1/600/800", label: "Clothes" },
              { title: "The Statement Watch", img: "https://picsum.photos/seed/trend-2/600/800", label: "Watches" },
              { title: "Architectural Footwear", img: "https://picsum.photos/seed/trend-3/600/800", label: "Shoes" },
              { title: "Sculptural Jewelry", img: "https://picsum.photos/seed/trend-4/600/800", label: "Accessories" }
            ].map((trend, idx) => (
              <motion.div
                key={trend.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl mb-6">
                  <img src={trend.img} alt={trend.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                </div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 mb-2">{trend.label}</p>
                <h4 className="text-xl font-serif italic group-hover:text-emerald-400 transition-colors">{trend.title}</h4>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/5 bg-[#080808] px-6 py-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-16">
          <div className="col-span-1 md:col-span-2">
            <h1 className="text-4xl font-serif italic mb-8 tracking-tighter">ULTIMATE HUB</h1>
            <p className="text-white/40 text-sm max-w-sm mb-10 leading-relaxed uppercase tracking-widest text-[11px]">
              The definitive destination for high-end fashion and lifestyle. Curated by experts for the modern aesthetic.
            </p>
            <div className="flex gap-8">
              <a href="#" className="text-white/40 hover:text-white transition-colors text-[10px] uppercase tracking-[0.3em]">Instagram</a>
              <a href="#" className="text-white/40 hover:text-white transition-colors text-[10px] uppercase tracking-[0.3em]">Twitter</a>
              {isOwner && (
                <a href="https://www.roposo.com/clout" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 transition-colors text-[10px] uppercase tracking-[0.3em] font-bold">Roposo Clout</a>
              )}
            </div>
          </div>
          <div>
            <h5 className="text-[11px] uppercase tracking-[0.4em] font-bold mb-8 text-white/60">Shop</h5>
            <ul className="space-y-5 text-[11px] uppercase tracking-widest text-white/30">
              <li><a href="#" className="hover:text-white transition-colors">New Arrivals</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Best Sellers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Collections</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Sale</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-[11px] uppercase tracking-[0.4em] font-bold mb-8 text-white/60">Support</h5>
            <ul className="space-y-5 text-[11px] uppercase tracking-widest text-white/30">
              <li><a href="#" className="hover:text-white transition-colors">Shipping</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Returns</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-20 pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between gap-6">
          <p className="text-[10px] text-white/20 uppercase tracking-[0.3em]">© 2026 Ultimate Hub. All Rights Reserved.</p>
          {isOwner && (
            <p className="text-[10px] text-white/20 uppercase tracking-[0.3em]">Powered by Roposo Clout Technology.</p>
          )}
        </div>
      </footer>

      {/* Owner Dashboard Modal */}
      <AnimatePresence>
        {isOwnerDashboardOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOwnerDashboardOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-3xl bg-[#0a0a0a] border border-emerald-500/30 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(16,185,129,0.1)]"
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between bg-emerald-500/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                    <Package className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif italic">Resell Management</h3>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-400/60 font-bold">Inventory & Roposo Import</p>
                  </div>
                </div>
                <button onClick={() => setIsOwnerDashboardOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 space-y-12">
                <section>
                  <h4 className="text-xs uppercase tracking-[0.4em] font-bold mb-6 text-white/40">Drop Product from Roposo</h4>
                  <div className="flex gap-4">
                    <div className="relative flex-1">
                      <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <input 
                        type="text"
                        value={roposoUrl}
                        onChange={(e) => setRoposoUrl(e.target.value)}
                        placeholder="Paste Roposo Product URL..."
                        className="w-full bg-black border border-white/10 rounded-xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-emerald-500 transition-all"
                      />
                    </div>
                    <button 
                      onClick={importFromRoposo}
                      disabled={isImporting || !roposoUrl.trim()}
                      className="px-8 bg-emerald-500 text-black text-[10px] uppercase tracking-widest font-bold rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                      {isImporting ? (
                        <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                      Drop Product
                    </button>
                  </div>
                  <p className="mt-4 text-[10px] text-white/30 uppercase tracking-widest">
                    AI will automatically extract product details and add them to your store.
                  </p>
                </section>

                <section>
                  <h4 className="text-xs uppercase tracking-[0.4em] font-bold mb-6 text-white/40">Current Inventory ({products.length})</h4>
                  <div className="max-h-[300px] overflow-y-auto space-y-4 pr-4 custom-scrollbar">
                    {products.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                        <div className="flex items-center gap-4">
                          <img src={p.image} className="w-12 h-12 object-cover rounded-lg" referrerPolicy="no-referrer" />
                          <div>
                            <p className="text-sm font-medium">{p.name}</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">${p.price} • {p.category}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteProduct(p.id)}
                          className="p-2 text-white/20 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCartOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-[#0a0a0a] z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <h3 className="text-2xl font-serif italic">Your Bag</h3>
                <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <ShoppingBag className="w-16 h-16 text-white/5 mb-6" />
                    <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] font-bold">Your bag is currently empty</p>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.id} className="flex gap-6">
                      <div className="w-28 h-36 bg-white/5 overflow-hidden rounded-sm">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div className="flex-1 flex flex-col">
                        <div className="flex justify-between mb-2">
                          <h4 className="text-sm font-medium tracking-tight">{item.name}</h4>
                          <button onClick={() => removeFromCart(item.id)} className="text-white/20 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-white/40 mb-auto font-mono">${item.price}</p>
                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center border border-white/10 rounded-full px-3 py-1.5">
                            <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:text-emerald-400 transition-colors">
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs w-10 text-center font-mono">{item.quantity}</span>
                            <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:text-emerald-400 transition-colors">
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-8 border-t border-white/5 space-y-6 bg-white/[0.02]">
                  <div className="flex justify-between text-[11px] uppercase tracking-[0.3em] font-bold">
                    <span className="text-white/40">Subtotal</span>
                    <span className="font-mono text-white">${cartTotal}</span>
                  </div>
                  <button 
                    onClick={() => handleAction('cart', cart[0])} // Just a trigger, handleAction handles the logic
                    className="w-full py-5 bg-white text-black text-[10px] uppercase tracking-[0.4em] font-bold hover:bg-emerald-400 transition-all active:scale-[0.98]"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Search Overlay */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/95 backdrop-blur-2xl p-6 flex flex-col items-center justify-center"
          >
            <button 
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery('');
              }}
              className="absolute top-10 right-10 p-4 hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            
            <div className="w-full max-w-4xl">
              <span className="text-[10px] uppercase tracking-[0.8em] text-emerald-400 font-bold mb-8 block text-center">Search The Collection</span>
              <div className="relative">
                <input 
                  autoFocus
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to find your aesthetic..."
                  className="w-full bg-transparent border-b-2 border-white/10 py-8 text-4xl sm:text-6xl font-serif italic focus:outline-none focus:border-emerald-500 transition-colors placeholder:text-white/5"
                />
                <Search className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 text-white/10" />
              </div>
              
              <div className="mt-12 flex flex-wrap justify-center gap-4">
                {['Minimalist', 'Obsidian', 'Heritage', 'Tailored', 'Silk'].map(term => (
                  <button 
                    key={term}
                    onClick={() => setSearchQuery(term)}
                    className="px-6 py-2 border border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5 rounded-full text-[10px] uppercase tracking-widest transition-all"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wishlist Sidebar */}
      <AnimatePresence>
        {isWishlistOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWishlistOpen(false)}
              className="fixed inset-0 z-[130] bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-[#080808] z-[140] shadow-2xl flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Heart className="w-5 h-5 text-emerald-400 fill-current" />
                  <h3 className="text-xl font-serif italic">Wishlist</h3>
                </div>
                <button onClick={() => setIsWishlistOpen(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {wishlist.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
                      <Heart className="w-8 h-8 text-white/10" />
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-widest text-white/40 mb-2">Your wishlist is empty</p>
                      <p className="text-[10px] text-white/20 uppercase tracking-widest">Save items you love to view them later.</p>
                    </div>
                    <button 
                      onClick={() => setIsWishlistOpen(false)}
                      className="px-8 py-4 border border-white/10 rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-white hover:text-black transition-all"
                    >
                      Continue Exploring
                    </button>
                  </div>
                ) : (
                  wishlist.map(item => (
                    <div key={item.id} className="flex gap-6 group">
                      <div className="w-24 h-32 bg-white/5 overflow-hidden rounded-sm relative">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => toggleWishlist(item)}
                          className="absolute top-2 right-2 p-1.5 bg-black/50 backdrop-blur-md rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-400 font-bold mb-1">{item.category}</p>
                        <h4 className="text-sm font-medium tracking-tight mb-2">{item.name}</h4>
                        <p className="text-xs text-white/40 font-mono mb-4">${item.price}</p>
                        <button 
                          onClick={() => {
                            handleAction('cart', item);
                            setIsWishlistOpen(false);
                          }}
                          className="text-[9px] uppercase tracking-widest font-bold text-white hover:text-emerald-400 transition-colors flex items-center gap-2"
                        >
                          Add to Bag <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Quick View Modal */}
      <AnimatePresence>
        {selectedQuickViewProduct && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedQuickViewProduct(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row"
            >
              <button 
                onClick={() => setSelectedQuickViewProduct(null)}
                className="absolute top-6 right-6 z-10 p-3 bg-black/50 backdrop-blur-md hover:bg-white hover:text-black rounded-full transition-all"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="w-full md:w-1/2 aspect-[4/5] md:aspect-auto bg-white/5">
                <img 
                  src={selectedQuickViewProduct.image} 
                  alt={selectedQuickViewProduct.name}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="w-full md:w-1/2 p-8 sm:p-12 flex flex-col justify-center">
                <div className="mb-10">
                  <span className="text-[10px] uppercase tracking-[0.4em] text-emerald-400 font-bold mb-4 block">
                    {selectedQuickViewProduct.category}
                  </span>
                  <h2 className="text-4xl sm:text-5xl font-serif italic mb-6 tracking-tight leading-tight">
                    {selectedQuickViewProduct.name}
                  </h2>
                  <p className="text-2xl font-mono text-white/90 mb-8">
                    ${selectedQuickViewProduct.price}
                  </p>
                  <p className="text-white/50 text-sm sm:text-base leading-relaxed font-light uppercase tracking-widest text-[11px]">
                    {selectedQuickViewProduct.description || "A meticulously crafted piece designed for the modern aesthetic. This item represents the pinnacle of contemporary luxury and timeless style."}
                  </p>
                </div>

                <div className="space-y-4">
                  <button 
                    onClick={() => {
                      handleAction('cart', selectedQuickViewProduct);
                      setSelectedQuickViewProduct(null);
                    }}
                    className="w-full py-5 bg-white text-black text-[10px] uppercase tracking-[0.4em] font-bold hover:bg-emerald-400 transition-all flex items-center justify-center gap-3"
                  >
                    Add to Bag <ShoppingBag className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      handleAction('save', selectedQuickViewProduct);
                      setSelectedQuickViewProduct(null);
                    }}
                    className="w-full py-5 border border-white/10 text-white text-[10px] uppercase tracking-[0.4em] font-bold hover:bg-white/5 transition-all flex items-center justify-center gap-3"
                  >
                    Save to Wishlist <Heart className="w-4 h-4" />
                  </button>
                </div>

                {isOwner && selectedQuickViewProduct.cloutLink && (
                  <div className="mt-10 pt-10 border-t border-white/5">
                    <a 
                      href={selectedQuickViewProduct.cloutLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-emerald-400 hover:text-emerald-300 transition-colors font-bold"
                    >
                      View on Roposo Clout <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Address Modal */}
      <AnimatePresence>
        {isAddressModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddressModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-[32px] p-10 overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-blue-500" />
              <button 
                onClick={() => setIsAddressModalOpen(false)}
                className="absolute top-8 right-8 p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="mb-10">
                <h2 className="text-4xl font-serif italic mb-4 tracking-tight">Delivery Address</h2>
                <p className="text-white/40 text-xs uppercase tracking-widest leading-relaxed">
                  Please provide your shipping details to complete the purchase.
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/40 ml-1">Full Address</label>
                  <textarea 
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    placeholder="Street, City, Zip Code, Country"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors min-h-[120px] resize-none"
                  />
                </div>
                
                <button 
                  onClick={submitAddress}
                  disabled={!addressInput.trim()}
                  className="w-full py-5 bg-white text-black text-xs uppercase tracking-[0.3em] font-bold hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:hover:bg-white flex items-center justify-center gap-3"
                >
                  Confirm & Continue <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {isAiAssistantOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAiAssistantOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-white/10 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif italic">AI Stylist</h3>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-bold">Ultimate Hub Concierge</p>
                  </div>
                </div>
                <button onClick={() => setIsAiAssistantOpen(false)} className="p-3 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-10 min-h-[350px] max-h-[550px] overflow-y-auto custom-scrollbar">
                {aiMessage ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="prose prose-invert max-w-none"
                  >
                    <div className="text-white/70 leading-relaxed font-light text-lg">
                      <Markdown>{aiMessage}</Markdown>
                    </div>
                    <button 
                      onClick={() => setAiMessage('')}
                      className="mt-10 text-[10px] uppercase tracking-[0.4em] text-emerald-400 hover:text-emerald-300 flex items-center gap-3 font-bold"
                    >
                      New Consultation <ArrowRight className="w-4 h-4" />
                    </button>
                  </motion.div>
                ) : isAiLoading ? (
                  <div className="h-full flex flex-col items-center justify-center gap-6 py-16">
                    <div className="w-16 h-16 border-2 border-emerald-500/10 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-[10px] uppercase tracking-[0.5em] text-emerald-400/60 font-bold animate-pulse">Curating your look...</p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    <p className="text-3xl font-serif italic text-white/80 leading-tight">
                      "How may I assist in defining your aesthetic today?"
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {[
                        "Curate a look for a high-profile event",
                        "What are the essential accessories?",
                        "Suggest a minimalist capsule",
                        "Show me the latest drops"
                      ].map(suggestion => (
                        <button 
                          key={suggestion}
                          onClick={() => setAiInput(suggestion)}
                          className="p-6 text-left border border-white/5 bg-white/[0.02] rounded-2xl hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all group"
                        >
                          <p className="text-xs text-white/50 group-hover:text-white transition-colors leading-relaxed">{suggestion}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!aiMessage && !isAiLoading && (
                <div className="p-8 border-t border-white/10 bg-white/[0.02]">
                  <div className="relative">
                    <input 
                      type="text"
                      value={aiInput}
                      onChange={(e) => setAiInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && askAiAssistant()}
                      placeholder="Describe your style vision..."
                      className="w-full bg-black border border-white/10 rounded-2xl py-5 pl-8 pr-20 text-sm focus:outline-none focus:border-emerald-500 transition-all placeholder:text-white/20"
                    />
                    <button 
                      onClick={askAiAssistant}
                      disabled={!aiInput.trim()}
                      className="absolute right-3 top-3 bottom-3 px-6 bg-white text-black rounded-xl text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:hover:bg-white"
                    >
                      Consult
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
            className="fixed inset-0 bg-[#050505] z-[100] p-10 flex flex-col"
          >
            <div className="flex justify-between items-center mb-20">
              <h1 className="text-3xl font-serif italic tracking-tighter">ULTIMATE HUB</h1>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                <X className="w-10 h-10" />
              </button>
            </div>
            <div className="flex flex-col gap-10">
              {categories.map((cat, idx) => (
                <motion.button 
                  key={cat}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  onClick={() => {
                    setActiveCategory(cat);
                    setIsMenuOpen(false);
                  }}
                  className="text-6xl font-serif italic text-left hover:text-emerald-400 transition-all tracking-tight"
                >
                  {cat}
                </motion.button>
              ))}
            </div>
            <div className="mt-auto space-y-10">
              {user ? (
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                  <div>
                    <p className="text-xl font-serif italic">{user.name}</p>
                    <p className="text-[10px] uppercase tracking-widest text-white/40">{user.isOwner ? 'Owner' : 'Member'}</p>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="px-6 py-2 border border-white/20 rounded-full text-[10px] uppercase tracking-widest font-bold hover:bg-white/10"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button 
                  onClick={handleLogin}
                  className="w-full py-4 bg-white text-black text-[10px] uppercase tracking-widest font-bold rounded-xl hover:bg-emerald-400 transition-all"
                >
                  Login with Google
                </button>
              )}
              {isOwner && (
                <a href="https://www.roposo.com/clout" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-emerald-400 uppercase tracking-[0.4em] text-[11px] font-bold border-b border-emerald-400/20 pb-6">
                  Roposo Clout <ExternalLink className="w-5 h-5" />
                </a>
              )}
              <div className="flex gap-6">
                <button 
                  onClick={() => {
                    setIsSearchOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="p-4 bg-white/5 rounded-2xl"
                >
                  <Search className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => {
                    setIsWishlistOpen(true);
                    setIsMenuOpen(false);
                  }}
                  className="p-4 bg-white/5 rounded-2xl relative"
                >
                  <Heart className="w-6 h-6" />
                  {wishlist.length > 0 && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-emerald-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                      {wishlist.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
