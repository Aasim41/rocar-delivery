import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';

interface UserContact {
  id: string;
  name: string;
  email: string;
}

interface FrequentContactsProps {
  onSelect: (user: UserContact) => void;
  excludeUserId: string;
}

const colorPalette = [
  'bg-zinc-700',
  'bg-stone-700',
  'bg-neutral-700',
  'bg-zinc-600',
  'bg-stone-600',
  'bg-neutral-600',
];

const getColorForName = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colorPalette.length;
  return colorPalette[index];
};

export const FrequentContacts: React.FC<FrequentContactsProps> = ({ onSelect, excludeUserId }) => {
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        setLoading(true);
        // Query deliveries where user is sender or receiver
        const { data: deliveriesData, error: deliveriesError } = await supabase
          .from('deliveries')
          .select('sender_id, receiver_id')
          .or(`sender_id.eq.${excludeUserId},receiver_id.eq.${excludeUserId}`);

        if (deliveriesError) throw deliveriesError;

        if (!deliveriesData || deliveriesData.length === 0) {
          setContacts([]);
          return;
        }

        // Count frequency of other users
        const frequencyMap: Record<string, number> = {};
        deliveriesData.forEach((delivery) => {
          const otherUserId = delivery.sender_id === excludeUserId ? delivery.receiver_id : delivery.sender_id;
          if (otherUserId && otherUserId !== excludeUserId) {
            frequencyMap[otherUserId] = (frequencyMap[otherUserId] || 0) + 1;
          }
        });

        // Get top 5 frequent contact IDs
        const sortedIds = Object.entries(frequencyMap)
          .sort(([, countA], [, countB]) => countB - countA)
          .slice(0, 5)
          .map(([id]) => id);

        if (sortedIds.length === 0) {
          setContacts([]);
          return;
        }

        // Fetch user details for these IDs
        const { data: usersData, error: usersError } = await supabase
          .from('users')
          .select('id, name, email')
          .in('id', sortedIds);

        if (usersError) throw usersError;

        if (usersData) {
            // keep the sorted order
            const orderedUsers = sortedIds.map(id => usersData.find(u => u.id === id)).filter((u): u is UserContact => u !== undefined);
            setContacts(orderedUsers);
        }
      } catch (error) {
        console.error('Error fetching frequent contacts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContacts();
  }, [excludeUserId]);

  if (loading || contacts.length === 0) {
    return null;
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } },
  };

  return (
    <div className="w-full my-4">
      <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase mb-3 px-2">Frequent</h3>
      <motion.div
        className="flex overflow-x-auto gap-4 px-2 pb-2 hide-scrollbar"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {contacts.map((contact) => (
          <motion.button
            key={contact.id}
            variants={itemVariants}
            onClick={() => onSelect(contact)}
            className="flex flex-col items-center flex-shrink-0 focus:outline-none"
          >
            <div
              className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-slate-100 ${getColorForName(contact.name)}`}
            >
              {contact.name ? contact.name.charAt(0).toUpperCase() : '?'}
            </div>
            <span className="mt-2 text-xs font-medium text-slate-300 truncate w-16 text-center">
              {contact.name ? contact.name.split(' ')[0] : 'Unknown'}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
};
