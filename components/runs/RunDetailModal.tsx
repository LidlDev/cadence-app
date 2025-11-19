'use client'

import { useState, useEffect } from 'react'
import { X, Heart, Zap, TrendingUp, Mountain, Thermometer, Activity, Footprints, Gauge, Clock, BarChart3 } from 'lucide-react'
import { PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'

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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard
                  icon={<Zap className="w-5 h-5" />}
                  label="Distance"
                  value={`${data.run.actual_distance || data.run.planned_distance} km`}
                  color="text-primary-600"
                />
                <StatCard
                  icon={<Clock className="w-5 h-5" />}
                  label="Time"
                  value={data.run.actual_time || 'N/A'}
                  color="text-blue-600"
                />
                <StatCard
                  icon={<TrendingUp className="w-5 h-5" />}
                  label="Pace"
                  value={data.run.actual_pace ? `${data.run.actual_pace}/km` : 'N/A'}
                  color="text-emerald-600"
                />
                <StatCard
                  icon={<Heart className="w-5 h-5" />}
                  label="Avg HR"
                  value={data.run.average_hr ? `${data.run.average_hr} bpm` : 'N/A'}
                  color="text-red-600"
                />
                <StatCard
                  icon={<Mountain className="w-5 h-5" />}
                  label="Elevation"
                  value={data.run.total_elevation_gain ? `${data.run.total_elevation_gain}m` : 'N/A'}
                  color="text-amber-600"
                />
              </div>

              {/* Additional Stats Row */}
              {(data.run.max_hr || data.run.average_cadence || data.run.calories) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {data.run.max_hr && (
                    <StatCard
                      icon={<Heart className="w-5 h-5" />}
                      label="Max HR"
                      value={`${data.run.max_hr} bpm`}
                      color="text-red-700"
                    />
                  )}
                  {data.run.average_cadence && (
                    <StatCard
                      icon={<Footprints className="w-5 h-5" />}
                      label="Avg Cadence"
                      value={`${Math.round(data.run.average_cadence * 2)} spm`}
                      color="text-purple-600"
                    />
                  )}
                  {data.run.calories && (
                    <StatCard
                      icon={<Zap className="w-5 h-5" />}
                      label="Calories"
                      value={`${data.run.calories} kcal`}
                      color="text-orange-600"
                    />
                  )}
                  {data.run.rpe && (
                    <StatCard
                      icon={<Gauge className="w-5 h-5" />}
                      label="RPE"
                      value={`${data.run.rpe}/10`}
                      color="text-indigo-600"
                    />
                  )}
                </div>
              )}

              {/* Pace Analysis Bar Chart with Trendline */}
              {data.streams?.velocity_smooth && data.streams?.distance && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-600" />
                    Pace Analysis by Kilometer
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={prepareKmPaceData(data.streams)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                      <XAxis
                        dataKey="km"
                        label={{ value: 'Kilometer', position: 'insideBottom', offset: -5 }}
                        stroke="#64748b"
                      />
                      <YAxis
                        label={{ value: 'Pace (min/km)', angle: -90, position: 'insideLeft' }}
                        stroke="#64748b"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f1f5f9' }}
                        formatter={(value: any) => [`${value} min/km`, 'Pace']}
                      />
                      <Bar dataKey="pace" fill="#10b981" radius={[8, 8, 0, 0]} />
                      <Line
                        type="monotone"
                        dataKey="trendline"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        strokeDasharray="5 5"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 text-center">
                    Red dashed line shows performance trend
                  </p>
                </div>
              )}

              {/* Splits Breakdown Table */}
              {data.streams?.velocity_smooth && data.streams?.distance && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    Kilometer Splits
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-300 dark:border-slate-600">
                          <th className="text-left py-2 px-3 text-slate-700 dark:text-slate-300 font-semibold">KM</th>
                          <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-semibold">Pace</th>
                          {data.streams?.heartrate && (
                            <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-semibold">Avg HR</th>
                          )}
                          {data.streams?.altitude && (
                            <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-semibold">Elev Δ</th>
                          )}
                          <th className="text-right py-2 px-3 text-slate-700 dark:text-slate-300 font-semibold">Split Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {prepareSplitsData(data.streams).map((split, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <td className="py-2 px-3 text-slate-900 dark:text-white font-medium">
                              {split.km}
                            </td>
                            <td className="py-2 px-3 text-right text-slate-900 dark:text-white">
                              {split.pace}
                            </td>
                            {data.streams?.heartrate && (
                              <td className="py-2 px-3 text-right text-slate-900 dark:text-white">
                                {split.avgHr ? `${split.avgHr} bpm` : '-'}
                              </td>
                            )}
                            {data.streams?.altitude && (
                              <td className="py-2 px-3 text-right text-slate-900 dark:text-white">
                                {split.elevDelta ? `${split.elevDelta > 0 ? '+' : ''}${split.elevDelta}m` : '-'}
                              </td>
                            )}
                            <td className="py-2 px-3 text-right text-slate-900 dark:text-white font-mono">
                              {split.splitTime}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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

              {/* Detailed Pace Graph */}
              {data.streams?.velocity_smooth && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Detailed Pace Over Distance
                  </h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={prepareDetailedPaceData(data.streams)}>
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
                        formatter={(value: any) => [`${value} min/km`, 'Pace']}
                      />
                      <Line
                        type="monotone"
                        dataKey="pace"
                        stroke="#10b981"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 text-center">
                    Granular pace data showing every data point
                  </p>
                </div>
              )}

              {/* Detailed Elevation Profile */}
              {data.streams?.altitude && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Mountain className="w-5 h-5 text-amber-600" />
                    Detailed Elevation Profile
                  </h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={prepareDetailedElevationData(data.streams)}>
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
                        formatter={(value: any) => [`${value}m`, 'Elevation']}
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
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 text-center">
                    Full elevation profile with all data points
                  </p>
                </div>
              )}

              {/* Detailed Heart Rate Graph */}
              {data.streams?.heartrate && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-600" />
                    Detailed Heart Rate Over Time
                  </h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={prepareDetailedHRData(data.streams)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                      <XAxis
                        dataKey="time"
                        label={{ value: 'Time (min)', position: 'insideBottom', offset: -5 }}
                        stroke="#64748b"
                      />
                      <YAxis
                        label={{ value: 'Heart Rate (bpm)', angle: -90, position: 'insideLeft' }}
                        stroke="#64748b"
                        domain={['dataMin - 10', 'dataMax + 10']}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f1f5f9' }}
                        formatter={(value: any) => [`${value} bpm`, 'Heart Rate']}
                      />
                      <Area
                        type="monotone"
                        dataKey="hr"
                        stroke="#ef4444"
                        fill="#ef4444"
                        fillOpacity={0.2}
                        strokeWidth={1.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 text-center">
                    Granular heart rate data showing every beat
                  </p>
                </div>
              )}

              {/* Cadence Graph */}
              {data.streams?.cadence && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Footprints className="w-5 h-5 text-purple-600" />
                    Cadence Over Time
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={prepareCadenceData(data.streams)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                      <XAxis
                        dataKey="time"
                        label={{ value: 'Time (min)', position: 'insideBottom', offset: -5 }}
                        stroke="#64748b"
                      />
                      <YAxis
                        label={{ value: 'Cadence (spm)', angle: -90, position: 'insideLeft' }}
                        stroke="#64748b"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="cadence"
                        stroke="#a855f7"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Detailed Power Graph */}
              {data.streams?.watts && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-yellow-600" />
                    Detailed Power Over Time
                  </h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={prepareDetailedPowerData(data.streams)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                      <XAxis
                        dataKey="time"
                        label={{ value: 'Time (min)', position: 'insideBottom', offset: -5 }}
                        stroke="#64748b"
                      />
                      <YAxis
                        label={{ value: 'Power (watts)', angle: -90, position: 'insideLeft' }}
                        stroke="#64748b"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f1f5f9' }}
                        formatter={(value: any) => [`${value}W`, 'Power']}
                      />
                      <Area
                        type="monotone"
                        dataKey="power"
                        stroke="#eab308"
                        fill="#eab308"
                        fillOpacity={0.2}
                        strokeWidth={1.5}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 text-center">
                    Full power output data
                  </p>
                </div>
              )}

              {/* Temperature Graph */}
              {data.streams?.temp && (
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Thermometer className="w-5 h-5 text-blue-600" />
                    Temperature Over Time
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={prepareTempData(data.streams)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                      <XAxis
                        dataKey="time"
                        label={{ value: 'Time (min)', position: 'insideBottom', offset: -5 }}
                        stroke="#64748b"
                      />
                      <YAxis
                        label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }}
                        stroke="#64748b"
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                        labelStyle={{ color: '#f1f5f9' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="temp"
                        stroke="#3b82f6"
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

// Detailed pace data (every 5th point for performance)
function prepareDetailedPaceData(streams: any) {
  if (!streams.velocity_smooth || !streams.distance) return []

  const data = []
  const velocityData = streams.velocity_smooth.data
  const distanceData = streams.distance.data

  for (let i = 0; i < velocityData.length; i += 5) {
    const velocity = velocityData[i] // m/s
    const distance = distanceData[i] / 1000 // Convert to km
    const paceMinPerKm = velocity > 0 ? (1000 / 60) / velocity : 0

    if (paceMinPerKm > 0 && paceMinPerKm < 15) { // Filter out unrealistic paces
      data.push({
        distance: distance.toFixed(2),
        pace: paceMinPerKm.toFixed(2),
      })
    }
  }

  return data
}

// Pace analysis by kilometer with trendline
function prepareKmPaceData(streams: any) {
  if (!streams.velocity_smooth || !streams.distance) return []

  const velocityData = streams.velocity_smooth.data
  const distanceData = streams.distance.data
  const kmData: { km: string; pace: number; trendline?: number }[] = []

  let currentKm = 1
  let kmStartIdx = 0

  for (let i = 0; i < distanceData.length; i++) {
    const distanceKm = distanceData[i] / 1000

    if (distanceKm >= currentKm || i === distanceData.length - 1) {
      // Calculate average pace for this km
      let totalPace = 0
      let count = 0

      for (let j = kmStartIdx; j <= i; j++) {
        const velocity = velocityData[j]
        if (velocity > 0) {
          const paceMinPerKm = (1000 / 60) / velocity
          if (paceMinPerKm > 0 && paceMinPerKm < 15) {
            totalPace += paceMinPerKm
            count++
          }
        }
      }

      if (count > 0) {
        const avgPace = totalPace / count
        kmData.push({
          km: `KM ${currentKm}`,
          pace: parseFloat(avgPace.toFixed(2)),
        })
      }

      currentKm++
      kmStartIdx = i + 1
    }
  }

  // Calculate linear trendline
  if (kmData.length > 1) {
    const n = kmData.length
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0

    kmData.forEach((point, idx) => {
      const x = idx + 1
      const y = point.pace
      sumX += x
      sumY += y
      sumXY += x * y
      sumX2 += x * x
    })

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n

    kmData.forEach((point, idx) => {
      point.trendline = parseFloat((slope * (idx + 1) + intercept).toFixed(2))
    })
  }

  return kmData
}

// Splits data with pace, HR, elevation, and time
function prepareSplitsData(streams: any) {
  if (!streams.velocity_smooth || !streams.distance || !streams.time) return []

  const velocityData = streams.velocity_smooth.data
  const distanceData = streams.distance.data
  const timeData = streams.time.data
  const hrData = streams.heartrate?.data
  const altitudeData = streams.altitude?.data

  const splits: any[] = []
  let currentKm = 1
  let kmStartIdx = 0
  let lastTime = 0

  for (let i = 0; i < distanceData.length; i++) {
    const distanceKm = distanceData[i] / 1000

    if (distanceKm >= currentKm || i === distanceData.length - 1) {
      // Calculate average pace for this km
      let totalPace = 0
      let paceCount = 0

      for (let j = kmStartIdx; j <= i; j++) {
        const velocity = velocityData[j]
        if (velocity > 0) {
          const paceMinPerKm = (1000 / 60) / velocity
          if (paceMinPerKm > 0 && paceMinPerKm < 15) {
            totalPace += paceMinPerKm
            paceCount++
          }
        }
      }

      const avgPace = paceCount > 0 ? totalPace / paceCount : 0
      const paceMin = Math.floor(avgPace)
      const paceSec = Math.round((avgPace - paceMin) * 60)

      // Calculate average HR for this km
      let avgHr = null
      if (hrData) {
        let totalHr = 0
        let hrCount = 0
        for (let j = kmStartIdx; j <= i; j++) {
          if (hrData[j] > 0) {
            totalHr += hrData[j]
            hrCount++
          }
        }
        avgHr = hrCount > 0 ? Math.round(totalHr / hrCount) : null
      }

      // Calculate elevation delta for this km
      let elevDelta = null
      if (altitudeData) {
        const startElev = altitudeData[kmStartIdx]
        const endElev = altitudeData[i]
        elevDelta = Math.round(endElev - startElev)
      }

      // Calculate split time
      const currentTime = timeData[i]
      const splitSeconds = currentTime - lastTime
      const splitMin = Math.floor(splitSeconds / 60)
      const splitSec = Math.round(splitSeconds % 60)

      splits.push({
        km: `KM ${currentKm}`,
        pace: `${paceMin}:${paceSec.toString().padStart(2, '0')}`,
        avgHr,
        elevDelta,
        splitTime: `${splitMin}:${splitSec.toString().padStart(2, '0')}`,
      })

      lastTime = currentTime
      currentKm++
      kmStartIdx = i + 1
    }
  }

  return splits
}

// Legacy function for compatibility
function preparePaceData(streams: any) {
  return prepareDetailedPaceData(streams)
}

// Detailed elevation data (every 5th point)
function prepareDetailedElevationData(streams: any) {
  if (!streams.altitude || !streams.distance) return []

  const data = []
  const altitudeData = streams.altitude.data
  const distanceData = streams.distance.data

  for (let i = 0; i < altitudeData.length; i += 5) {
    data.push({
      distance: (distanceData[i] / 1000).toFixed(2),
      elevation: altitudeData[i].toFixed(1),
    })
  }

  return data
}

// Legacy function for compatibility
function prepareElevationData(streams: any) {
  return prepareDetailedElevationData(streams)
}

// Detailed HR data (every 3rd point for smooth visualization)
function prepareDetailedHRData(streams: any) {
  if (!streams.heartrate || !streams.time) return []

  const data = []
  const hrData = streams.heartrate.data
  const timeData = streams.time.data

  for (let i = 0; i < hrData.length; i += 3) {
    if (hrData[i] > 0) { // Filter out zero values
      data.push({
        time: (timeData[i] / 60).toFixed(1), // Convert to minutes
        hr: hrData[i],
      })
    }
  }

  return data
}

// Legacy function for compatibility
function prepareHRData(streams: any) {
  return prepareDetailedHRData(streams)
}

function prepareCadenceData(streams: any) {
  if (!streams.cadence || !streams.time) return []

  const data = []
  const cadenceData = streams.cadence.data
  const timeData = streams.time.data

  for (let i = 0; i < cadenceData.length; i += 5) {
    if (cadenceData[i] > 0) { // Filter out zero values
      data.push({
        time: (timeData[i] / 60).toFixed(1), // Convert to minutes
        cadence: cadenceData[i] * 2, // Strava returns steps per second, multiply by 2 for spm
      })
    }
  }

  return data
}

// Detailed power data (every 5th point)
function prepareDetailedPowerData(streams: any) {
  if (!streams.watts || !streams.time) return []

  const data = []
  const powerData = streams.watts.data
  const timeData = streams.time.data

  for (let i = 0; i < powerData.length; i += 5) {
    if (powerData[i] > 0) { // Filter out zero values
      data.push({
        time: (timeData[i] / 60).toFixed(1), // Convert to minutes
        power: powerData[i],
      })
    }
  }

  return data
}

// Legacy function for compatibility
function preparePowerData(streams: any) {
  return prepareDetailedPowerData(streams)
}

function prepareTempData(streams: any) {
  if (!streams.temp || !streams.time) return []

  const data = []
  const tempData = streams.temp.data
  const timeData = streams.time.data

  for (let i = 0; i < tempData.length; i += 10) { // Sample every 10 points
    data.push({
      time: (timeData[i] / 60).toFixed(1), // Convert to minutes
      temp: tempData[i],
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

