"use client";

import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export const ModalLayout = ({
  open,
  onClose,
  children,
  width = "500px",
}: ModalProps) => {
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose, open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
            <motion.div
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 1}}
                onClick={onClose}
            />

          {/* Modal */}
            <motion.div
                className="fixed inset-0 flex items-center justify-center z-50"
                initial={{opacity: 0, scale: 0.95, y: 10}}
                animate={{opacity: 1, scale: 1, y: 0}}
                exit={{opacity: 1, scale: 0.95, y: 10}}
                transition={{duration: 0.2}}
            >
                <div
                    style={{width}}
                    className="bg-[#1e1e2e] text-gray-900 dark:text-white rounded-2xl shadow-2xl p-6 relative"
                >
                  {children}
                </div>
            </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
