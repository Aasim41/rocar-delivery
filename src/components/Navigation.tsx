import { NavLink } from 'react-router-dom';
import { Home, Package, ShoppingBag, User } from 'lucide-react';

export function Navigation() {
  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/parcel-pickup', icon: Package, label: 'Parcel' },
    { to: '/marketplace', icon: ShoppingBag, label: 'Shop' },
    { to: '/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed bottom-6 left-0 right-0 z-50 px-6 pointer-events-none">
      <div className="max-w-xs mx-auto pointer-events-auto flex justify-center">
        <nav className="nav-menu">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'active' : ''}`
              }
            >
              <span className="nav-link-icon">
                <item.icon />
              </span>
              <span className="nav-link-title">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
