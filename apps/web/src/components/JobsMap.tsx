'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Circle, CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import type { JobCoarseView } from '@contractor-bidder/types';
import { formatWorkType } from '@contractor-bidder/types';
import { formatBudget } from '@contractor-bidder/ui';
import { boundsForRadiusMiles, milesToMeters } from '@/lib/mapUtils';
import 'leaflet/dist/leaflet.css';

export interface JobsMapProps {
  jobs: JobCoarseView[];
  center: { lat: number; lng: number };
  radiusMiles: number;
}

function MapViewport({ center, jobs, radiusMiles }: JobsMapProps) {
  const map = useMap();

  useEffect(() => {
    if (jobs.length === 0) {
      map.fitBounds(boundsForRadiusMiles(center, radiusMiles), { padding: [24, 24] });
      return;
    }

    const points: [number, number][] = [
      [center.lat, center.lng],
      ...jobs.map((job) => [job.coarseLat, job.coarseLng] as [number, number]),
    ];
    map.fitBounds(points, { padding: [32, 32], maxZoom: 13 });
  }, [center, jobs, radiusMiles, map]);

  return null;
}

export default function JobsMap({ jobs, center, radiusMiles }: JobsMapProps) {
  const region = boundsForRadiusMiles(center, radiusMiles);
  const mapCenter: [number, number] = [center.lat, center.lng];

  return (
    <MapContainer
      center={mapCenter}
      bounds={region}
      className="jobs-map"
      scrollWheelZoom
      attributionControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewport center={center} jobs={jobs} radiusMiles={radiusMiles} />
      <Circle
        center={mapCenter}
        radius={milesToMeters(radiusMiles)}
        pathOptions={{
          color: '#2563eb',
          weight: 2,
          fillColor: '#2563eb',
          fillOpacity: 0.08,
        }}
      />
      <CircleMarker
        center={mapCenter}
        radius={7}
        pathOptions={{
          color: '#1d4ed8',
          weight: 2,
          fillColor: '#2563eb',
          fillOpacity: 1,
        }}
      >
        <Popup>You</Popup>
      </CircleMarker>
      {jobs.map((job) => (
        <CircleMarker
          key={job.id}
          center={[job.coarseLat, job.coarseLng]}
          radius={9}
          pathOptions={{
            color: '#0f766e',
            weight: 2,
            fillColor: '#14b8a6',
            fillOpacity: 0.92,
          }}
        >
          <Popup>
            <div className="jobs-map-popup">
              <p className="jobs-map-popup-title">{job.title}</p>
              <p className="jobs-map-popup-meta">
                {formatWorkType(job.workType)} · {formatBudget(job)}
              </p>
              <Link href={`/jobs/${job.id}`} className="jobs-map-popup-link">
                View job
              </Link>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
