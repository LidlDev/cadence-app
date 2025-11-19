'use client'

import { useState, useEffect } from 'react'
import { X, Heart, Zap, TrendingUp, Mountain, Thermometer, Activity } from 'lucide-react'
import { PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface RunDetailModalProps {
  isOpen: boolean
  onClose: () => void
  runId: string
  userId: string
}

interface ActivityData {
  run: any
  streams: any
  hrZones: any
}

export default function RunDetailModal({ isOpen, onClose, runId, userId }: RunDetailModalProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ActivityData | null>(null)

  useEffect(() => {
    if (isOpen && runId) {
      fetchActivityData()
    }
  }, [isOpen, runId])

  const fetchActivityData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/runs/${runId}/details`)
      const result = await response.json()
      
      if (result.success) {
        setData(result.data)
      }
    } catch (error) {
      console.error('Error fetching activity data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const HR_ZONE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#dc2626']

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between z-10">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Activity className="w-6 h-6 text-primary-600" />
            Run Details
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard
                  icon={<Zap className="w-5 h-5" />}
                  label="Distance"
                  value={`${data.run.actual_distance || data.run.planned_distance} km`}
                  color="text-primary-600"
                />
                <StatCard
                  icon={<Heart className="w-5 h-5" />}
                  label="Avg Heart Rate"
                  value={data.run.average_hr ? `${data.run.average_hr} bpm` : 'N/A'}
                  color="text-red-600"
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Pace"
                  value={data.run.actual_pace || data.run.target_pace || 'N/A'}
                  color="text-emerald-600"
                />
                <StatCard
                  icon={<Mountain className="w-5 h-5" />}
                  label="Elevation"
                  value={data.run.total_elevation_gain ? `${data.run.total_elevation_gain}m` : 'N/A'}
                  color="text-amber-600"
                />
              </div>

              {/* Heart Rate Zones */}
              {data.hrZones && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-600" />
                    Heart Rate Zones
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Pie Chart */}
                    <div className="flex items-center justify-center">
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Zone 1 (<60%)', value: data.hrZones.zone_1_time, fill: HR_ZONE_COLORS[0] },
                              { name: 'Zone 2 (60-70%)', value: data.hrZones.zone_2_time, fill: HR_ZONE_COLORS[1] },
                              { name: 'Zone 3 (70-80%)', value: data.hrZones.zone_3_time, fill: HR_ZONE_COLORS[2] },
                              { name: 'Zone 4 (80-90%)', value: data.hrZones.zone_4_time, fill: HR_ZONE_COLORS[3] },
                              { name: 'Zone 5 (>90%)', value: data.hrZones.zone_5_time, fill: HR_ZONE_COLORS[4] },
                            ].filter(zone => zone.value > 0)}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                            outerRadius={80}
                            dataKey="value"
                          >
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Zone Breakdown */}
                    <div className="space-y-2">
                      {[
                        { zone: 1, name: 'Recovery', range: '<60%', time: data.hrZones.zone_1_time, color: HR_ZONE_COLORS[0] },
                        { zone: 2, name: 'Aerobic', range: '60-70%', time: data.hrZones.zone_2_time, color: HR_ZONE_COLORS[1] },
                        { zone: 3, name: 'Tempo', range: '70-80%', time: data.hrZones.zone_3_time, color: HR_ZONE_COLORS[2] },
                        { zone: 4, name: 'Threshold', range: '80-90%', time: data.hrZones.zone_4_time, color: HR_ZONE_COLORS[3] },
                        { zone: 5, name: 'Max', range: '>90%', time: data.hrZones.zone_5_time, color: HR_ZONE_COLORS[4] },
                      ].map((zone) => (
                        <div key={zone.zone} className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }}></div>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              Zone {zone.zone}: {zone.name}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {zone.range}
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {formatTime(zone.time)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Pace Graph */}
              {data.streams?.velocity_smooth && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Pace Over Distance
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={preparePaceData(data.streams)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                      <XAxis
                        dataKey="distance"
                        label={{ value: 'Distance (km)', position: 'insideBottom', offset: -5 }}
                        stroke="#64748b"
                      />
                      <YAxis
                        label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft' }}
                        stroke="#64748b"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="pace"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Elevation Profile */}
              {data.streams?.altitude && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Mountain className="w-5 h-5 text-amber-600" />
                    Elevation Profile
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={prepareElevationData(data.streams)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                      <XAxis
                        dataKey="distance"
                        label={{ value: 'Distance (km)', position: 'insideBottom', offset: -5 }}
                        stroke="#64748b"
                      />
                      <YAxis
                        label={{ value: 'Elevation (m)', angle: -90, position: 'insideLeft' }}
                        stroke="#64748b"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="elevation"
                        stroke="#f59e0b"
                        fill="#f59e0b"
                        fillOpacity={0.3}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Heart Rate Graph */}
              {data.streams?.heartrate && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-600" />
                    Heart Rate Over Time
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={prepareHRData(data.streams)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                      <XAxis
                        dataKey="time"
                        label={{ value: 'Time (min)', position: 'insideBottom', offset: -5 }}
                        stroke="#64748b"
                      />
                      <YAxis
                        label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideLeft' }}
                        stroke="#64748b"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="hr"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Additional Stats */}
              {data.run.suffer_score && (
                <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-red-200 dark:border-red-800">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                    Suffer Score
                  </h3>
                  <p className="text-4xl font-bold text-red-600 dark:text-red-400">
                    {data.run.suffer_score}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Based on heart rate intensity and duration
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">No detailed data available for this run.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper functions to prepare chart data
function preparePaceData(streams: any) {
  if (!streams.velocity_smooth || !streams.distance) return []

  const data = []
  const velocityData = streams.velocity_smooth.data
  const distanceData = streams.distance.data

  for (let i = 0; i < velocityData.length; i += 10) { // Sample every 10 points
    const velocity = velocityData[i] // m/s
    const distance = distanceData[i] / 1000 // Convert to km
    const paceMinPerKm = velocity > 0 ? (1000 / 60) / velocity : 0

    data.push({
      distance: distance.toFixed(2),
      pace: paceMinPerKm.toFixed(2),
    })
  }

  return data
}

function prepareElevationData(streams: any) {
  if (!streams.altitude || !streams.distance) return []

  const data = []
  const altitudeData = streams.altitude.data
  const distanceData = streams.distance.data

  for (let i = 0; i < altitudeData.length; i += 10) { // Sample every 10 points
    data.push({
      distance: (distanceData[i] / 1000).toFixed(2),
      elevation: altitudeData[i].toFixed(1),
    })
  }

  return data
}

function prepareHRData(streams: any) {
  if (!streams.heartrate || !streams.time) return []

  const data = []
  const hrData = streams.heartrate.data
  const timeData = streams.time.data

  for (let i = 0; i < hrData.length; i += 10) { // Sample every 10 points
    data.push({
      time: (timeData[i] / 60).toFixed(1), // Convert to minutes
      hr: hrData[i],
    })
  }

  return data
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
      <div className={`${color} mb-2`}>{icon}</div>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  )
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

