"use client";

import { motion } from "framer-motion";
import { SiTypescript, SiNodedotjs, SiMongodb } from "react-icons/si";
import { Zap, Code, Braces } from "lucide-react";

const pathVariants: any = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: (i: number) => ({
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 1.5, ease: "easeInOut", delay: i * 0.2 },
      opacity: { duration: 0.5, delay: i * 0.2 },
    },
  }),
};

export function LeftHeroAnimation() {
  return (
    <div className="absolute -left-4/12 top-1/2 -translate-y-1/2 w-[300px] h-[400px] hidden xl:block pointer-events-none z-0">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 300 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="opacity-60"
      >
        {/* Paths */}
        {/* Top to Center */}
        <motion.path
          d="M 40 80 C 140 80, 160 200, 300 200"
          stroke="url(#gradient-left)"
          strokeWidth="2"
          fill="transparent"
          initial="hidden"
          animate="visible"
          custom={0}
          variants={pathVariants}
        />
        {/* Middle to Center */}
        <motion.path
          d="M 40 200 L 300 200"
          stroke="url(#gradient-left)"
          strokeWidth="2"
          fill="transparent"
          initial="hidden"
          animate="visible"
          custom={1}
          variants={pathVariants}
        />
        {/* Bottom to Center */}
        <motion.path
          d="M 40 320 C 140 320, 160 200, 300 200"
          stroke="url(#gradient-left)"
          strokeWidth="2"
          fill="transparent"
          initial="hidden"
          animate="visible"
          custom={2}
          variants={pathVariants}
        />

        <defs>
          <linearGradient
            id="gradient-left"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="300"
            y2="0"
          >
            <stop offset="0%" stopColor="#00B3B7" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#00B3B7" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>

      {/* Floating Icons */}
      {/* TS */}
      <motion.div
        className="absolute left-[10px] top-[50px] w-12 h-12 bg-white rounded-full shadow-lg border border-[#00B3B7]/20 flex items-center justify-center text-[#3178C6]"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <SiTypescript size={20} />
      </motion.div>

      {/* Zap */}
      <motion.div
        className="absolute left-[10px] top-[176px] w-12 h-12 bg-white rounded-full shadow-lg border border-[#00B3B7]/20 flex items-center justify-center text-[#00B3B7]"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <Zap size={20} fill="currentColor" />
      </motion.div>

      {/* Leaf (Mongo) */}
      <motion.div
        className="absolute left-[10px] top-[296px] w-12 h-12 bg-white rounded-full shadow-lg border border-[#00B3B7]/20 flex items-center justify-center text-[#4DB33D]"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.6 }}
      >
        <SiMongodb size={20} />
      </motion.div>

      {/* Particles flowing */}
      {/* Note: offset-path requires CSS definition or style prop */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-2 h-2 bg-[#00B3B7] rounded-full top-0 left-0"
          style={{ offsetPath: 'path("M 40 80 C 140 80, 160 200, 300 200")' }}
          animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 0] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
            delay: 1,
          }}
        />
        <motion.div
          className="absolute w-2 h-2 bg-[#00B3B7] rounded-full top-0 left-0"
          style={{ offsetPath: 'path("M 40 200 L 300 200")' }}
          animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 0] }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "linear",
            delay: 1.5,
          }}
        />
        <motion.div
          className="absolute w-2 h-2 bg-[#00B3B7] rounded-full top-0 left-0"
          style={{ offsetPath: 'path("M 40 320 C 140 320, 160 200, 300 200")' }}
          animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 0] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
            delay: 2,
          }}
        />
      </div>
    </div>
  );
}

export function RightHeroAnimation() {
  return (
    <div className="absolute -right-4/12 top-1/2 -translate-y-1/2 w-[300px] h-[400px] hidden xl:block pointer-events-none z-0">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 300 400"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="opacity-60"
      >
        {/* Center to Top */}
        <motion.path
          d="M 0 200 C 140 200, 160 80, 260 80"
          stroke="url(#gradient-right)"
          strokeWidth="2"
          fill="transparent"
          initial="hidden"
          animate="visible"
          custom={0}
          variants={pathVariants}
        />
        {/* Center to Middle */}
        <motion.path
          d="M 0 200 L 260 200"
          stroke="url(#gradient-right)"
          strokeWidth="2"
          fill="transparent"
          initial="hidden"
          animate="visible"
          custom={1}
          variants={pathVariants}
        />
        {/* Center to Bottom */}
        <motion.path
          d="M 0 200 C 140 200, 160 320, 260 320"
          stroke="url(#gradient-right)"
          strokeWidth="2"
          fill="transparent"
          initial="hidden"
          animate="visible"
          custom={2}
          variants={pathVariants}
        />

        <defs>
          <linearGradient
            id="gradient-right"
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="0"
            x2="300"
            y2="0"
          >
            <stop offset="0%" stopColor="#00B3B7" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00B3B7" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>

      {/* Floating Icons - Right Aligned */}
      {/* Code */}
      <motion.div
        className="absolute right-[10px] top-[50px] w-12 h-12 bg-white rounded-full shadow-lg border border-[#00B3B7]/20 flex items-center justify-center text-[#00B3B7]"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <Code size={20} />
      </motion.div>

      {/* Node */}
      <motion.div
        className="absolute right-[10px] top-[176px] w-12 h-12 bg-white rounded-full shadow-lg border border-[#00B3B7]/20 flex items-center justify-center text-[#5FA04E]"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <SiNodedotjs size={20} />
      </motion.div>

      {/* Braces */}
      <motion.div
        className="absolute right-[10px] top-[296px] w-12 h-12 bg-white rounded-full shadow-lg border border-[#00B3B7]/20 flex items-center justify-center text-[#00B3B7]"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        <Braces size={20} />
      </motion.div>

      {/* Particles flowing */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute w-2 h-2 bg-[#00B3B7] rounded-full top-0 left-0"
          style={{ offsetPath: 'path("M 0 200 C 140 200, 160 80, 260 80")' }}
          animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 0] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
            delay: 1.2,
          }}
        />
        <motion.div
          className="absolute w-2 h-2 bg-[#00B3B7] rounded-full top-0 left-0"
          style={{ offsetPath: 'path("M 0 200 L 260 200")' }}
          animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 0] }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "linear",
            delay: 1.7,
          }}
        />
        <motion.div
          className="absolute w-2 h-2 bg-[#00B3B7] rounded-full top-0 left-0"
          style={{ offsetPath: 'path("M 0 200 C 140 200, 160 320, 260 320")' }}
          animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 0] }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
            delay: 2.2,
          }}
        />
      </div>
    </div>
  );
}
