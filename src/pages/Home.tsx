import { Link } from 'react-router-dom';
import { Package, ShoppingBag } from 'lucide-react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

function TiltCard({ to, icon: Icon, title, description, colorClass }: any) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);
  
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <Link to={to} className="block" style={{ perspective: 1000 }}>
      <motion.div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className={`relative w-full glass-card home-card p-6 h-56 flex flex-col justify-between cursor-pointer ${colorClass}`}
      >
        <div style={{ transform: "translateZ(50px)" }} className="relative z-10 pointer-events-none">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/30 shadow-lg">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight leading-none drop-shadow-md">{title}</h2>
          <p className="text-white/90 font-medium mt-2 text-sm drop-shadow-sm">{description}</p>
        </div>
        
        {/* Animated Glare Effect */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 mix-blend-overlay rounded-2xl"
          style={{
            background: "linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.4) 25%, transparent 30%)",
            backgroundSize: "200% 200%",
            backgroundPosition: useTransform(mouseXSpring, [-0.5, 0.5], ["100% 100%", "0% 0%"])
          }}
        />
      </motion.div>
    </Link>
  );
}

export function Home() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-6 max-w-md mx-auto min-h-screen pb-32 bg-[var(--bg-page)] font-sans relative overflow-hidden"
    >
      {/* Soft Background Blobs */}
      <div className="absolute top-0 left-[-20%] w-96 h-96 bg-[var(--color-sky)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />
      <div className="absolute top-[40%] right-[-20%] w-80 h-80 bg-[var(--color-green)] rounded-full opacity-10 blur-[100px] pointer-events-none z-0" />

      <header className="mb-12 mt-6 relative z-10">
        <h1 className="text-5xl font-extrabold text-[var(--text-main)] tracking-tight leading-tight">
          Delivery<br/>
          <span className="text-[var(--color-sky)]">Robot</span>
        </h1>
        <p className="text-lg font-medium text-[var(--text-muted)] mt-4">
          Autonomous logistics for your campus.
        </p>
      </header>

      <div className="space-y-6 relative z-10">
        <TiltCard 
          to="/parcel-pickup"
          icon={Package}
          title="Send Parcel"
          description="A-to-B campus delivery"
          colorClass="bg-gradient-to-br from-[var(--color-sky)] to-blue-600"
        />

        <TiltCard 
          to="/marketplace"
          icon={ShoppingBag}
          title="Marketplace"
          description="Order essentials from shops"
          colorClass="bg-gradient-to-br from-[var(--color-yellow)] to-orange-500"
        />
      </div>
    </motion.div>
  );
}
