/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Maximize2, Monitor, Play, Smartphone, X } from "lucide-react";

const imagePrefix = "/media/plan-my-workday/pmwd-screenshots/full_keyboard";

export default function FeatureImageHomepage() {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div>
        <div className="hidden lg:block">
          <button type="button" className="group block w-full cursor-pointer text-left" onClick={() => setIsModalOpen(true)}>
            <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 p-8 shadow-xl transition-all duration-500 hover:scale-[1.01] hover:shadow-2xl">
              <div className="relative rounded-2xl bg-slate-900 p-1 shadow-2xl">
                <div className="absolute -bottom-8 left-1/2 h-3 w-24 -translate-x-1/2 rounded-full bg-slate-700" />
                <div className="absolute -bottom-6 left-1/2 h-8 w-4 -translate-x-1/2 rounded-t-lg bg-slate-700" />

                <div className="overflow-hidden rounded-xl border border-slate-700 bg-white">
                  <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-400" />
                        <div className="h-3 w-3 rounded-full bg-yellow-400" />
                        <div className="h-3 w-3 rounded-full bg-green-400" />
                      </div>
                      <div className="ml-2 flex items-center gap-2">
                        <Monitor className="h-3 w-3 text-slate-500" />
                        <span className="text-xs font-medium text-slate-500">Plan My Workday</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      <Maximize2 className="h-3 w-3" />
                      <span className="hidden text-xs font-medium sm:block">Click to expand</span>
                    </div>
                  </div>

                  <div className="relative aspect-video w-full bg-slate-50">
                    <img
                      src={`${imagePrefix}_desktop.png`}
                      alt="Full keyboard navigation with integrated timer"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover:bg-black/5 group-hover:opacity-100">
                      <div className="rounded-xl border border-slate-200 bg-white/95 px-6 py-3 shadow-lg backdrop-blur-sm transition-transform duration-200 group-hover:scale-100">
                        <div className="flex items-center gap-2 font-medium text-slate-700">
                          <Play className="h-4 w-4" />
                          View Full
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -right-4 -top-4 h-32 w-32 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 blur-2xl" />
              <div className="absolute -bottom-4 -left-4 h-40 w-40 rounded-full bg-gradient-to-tr from-green-500/10 to-blue-500/10 blur-2xl" />
            </div>
          </button>
        </div>

        <div className="hidden md:block lg:hidden">
          <button type="button" className="mx-auto block w-full max-w-3xl cursor-pointer text-left" onClick={() => setIsModalOpen(true)}>
            <div className="rounded-2xl bg-slate-800 p-1 shadow-2xl transition-all duration-300 hover:shadow-2xl">
              <div className="overflow-hidden rounded-xl border border-slate-600 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
                      <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
                    </div>
                    <Monitor className="ml-1 h-2.5 w-2.5 text-slate-400" />
                  </div>
                  <Maximize2 className="h-3 w-3 text-slate-400" />
                </div>
                <div className="relative aspect-video w-full">
                  <img
                    src={`${imagePrefix}_desktop.png`}
                    alt="Full keyboard navigation with integrated timer"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
              <div className="h-2 rounded-b-xl bg-slate-700" />
            </div>
          </button>
        </div>

        <div className="block md:hidden">
          <button type="button" className="mx-auto block w-full max-w-sm cursor-pointer text-left" onClick={() => setIsModalOpen(true)}>
            <div className="rounded-[2.5rem] bg-slate-900 p-3 shadow-2xl transition-all duration-300 hover:shadow-2xl">
              <div className="rounded-[2rem] bg-black p-1">
                <div className="relative overflow-hidden rounded-[1.8rem] bg-white" style={{ aspectRatio: "850/1888" }}>
                  <img
                    src={`${imagePrefix}_mobile.png`}
                    alt="Full keyboard navigation mobile preview"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                    <div className="rounded-full bg-black/60 px-3 py-1 backdrop-blur-sm">
                      <span className="text-xs font-medium text-white">Tap to expand</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
          <div className="relative hidden w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl md:block">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-6 py-4">
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-400" />
                  <div className="h-3 w-3 rounded-full bg-yellow-400" />
                  <div className="h-3 w-3 rounded-full bg-green-400" />
                </div>
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-slate-500" />
                  <h3 className="font-semibold text-slate-900">Keyboard Navigation + Timer</h3>
                </div>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg p-2 transition hover:bg-slate-200">
                <X className="h-5 w-5 text-slate-600" />
              </button>
            </div>
            <div className="relative aspect-video w-full bg-slate-50">
              <img
                src={`${imagePrefix}_desktop.png`}
                alt="Full keyboard navigation desktop preview"
                className="h-full w-full object-contain"
              />
            </div>
          </div>

          <div className="relative block max-h-full w-full max-w-sm overflow-hidden rounded-3xl bg-slate-900 shadow-2xl md:hidden">
            <div className="flex items-center justify-between bg-slate-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-slate-300" />
                <h3 className="text-sm font-semibold text-white">Keyboard Navigation</h3>
              </div>
              <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg p-2 transition hover:bg-slate-700">
                <X className="h-4 w-4 text-slate-300" />
              </button>
            </div>
            <div className="p-4">
              <div className="rounded-[2rem] bg-black p-1">
                <div className="overflow-hidden rounded-[1.8rem] bg-white" style={{ aspectRatio: "850/1888" }}>
                  <img
                    src={`${imagePrefix}_mobile.png`}
                    alt="Full keyboard navigation mobile preview"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>
          </div>

          <button type="button" aria-label="Close preview" className="absolute inset-0 -z-10" onClick={() => setIsModalOpen(false)} />
        </div>
      )}
    </>
  );
}
