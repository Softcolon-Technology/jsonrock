import React from "react";
import Link from "next/link";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-white pt-10 border-t border-[#D9D9D9]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col items-center text-center max-w-[875px] mx-auto">
          {/* Logo */}
          <div className="mb-3">
            <Image
              src="/jsonrock-dark.svg"
              alt="JsonRock"
              width={140}
              height={40}
              className="h-8 w-auto"
            />
          </div>

          {/* Tagline */}
          <p className="text-paragraph text-sm md:text-base mb-3 md:mb-5">
            The visualization standard for technical data structures. Built by
            developers, for developers.
          </p>

          {/* Primary Nav */}
          <div className="w-full flex justify-center border-t border-b border-[#D9D9D9] py-2.5 mb-10">
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-4">
              {["Documentation", "API Reference", "Community", "Support"].map(
                (item, index, array) => (
                  <React.Fragment key={item}>
                    <Link
                      href="#"
                      className="flex items-center gap-2 text-zinc-600 hover:text-[#00B3B7] font-medium text-sm transition-colors"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00B3B7]"></span>
                      {item}
                    </Link>
                    {index < array.length - 1 && (
                      <div className="h-4 w-px bg-[#D9D9D9] hidden sm:block" />
                    )}
                  </React.Fragment>
                ),
              )}
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-[#00B3B7] py-6 text-white text-xs md:text-sm font-medium">
        <p className="text-center">
          © {new Date().getFullYear()} JSON Rock Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
