import React from 'react';
import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Chatroom' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/config', label: 'Config' },
  { to: '/settings', label: 'Settings' },
  { to: '/runs', label: 'Runs' }
];

export default function Nav() {
  return (
    <nav className="sidebar">
      <div className="brand">
        <div className="brand-mark">OC</div>
        <div>
          <div className="brand-title">Swarm Studio</div>
          <div className="brand-subtitle">OpenClaw Agent Team</div>
        </div>
      </div>
      <div className="nav-links">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            end={link.to === '/'}
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
