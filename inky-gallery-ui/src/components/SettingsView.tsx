import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Monitor,
  RotateCcw,
  Sun,
  Contrast,
  Sparkles,
  Palette,
  Droplets,
  Save,
  RotateCw,
  Clock,
  Globe,
  Activity,
  FlipVertical,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DeviceSettings, PlaybackSettings } from '@/data/types';

interface SettingsProps {
  deviceSettings: DeviceSettings;
  playbackSettings: PlaybackSettings;
  onDeviceSettingsChange: (settings: DeviceSettings) => void;
  onPlaybackSettingsChange: (settings: PlaybackSettings) => void;
}

export default function Settings({
  deviceSettings,
  playbackSettings,
  onDeviceSettingsChange,
  onPlaybackSettingsChange,
}: SettingsProps) {
  const [localDevice, setLocalDevice] = useState(deviceSettings);
  const [localPlayback, setLocalPlayback] = useState(playbackSettings);
  const [hasChanges, setHasChanges] = useState(false);

  const updateDevice = (patch: Partial<DeviceSettings>) => {
    setLocalDevice((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  };

  const updateImageSetting = (key: string, value: number) => {
    setLocalDevice((prev) => ({
      ...prev,
      image_settings: { ...prev.image_settings, [key]: value },
    }));
    setHasChanges(true);
  };

  const updatePlayback = (patch: Partial<PlaybackSettings>) => {
    setLocalPlayback((prev) => ({ ...prev, ...patch }));
    setHasChanges(true);
  };

  const handleSave = () => {
    onDeviceSettingsChange(localDevice);
    onPlaybackSettingsChange(localPlayback);
    setHasChanges(false);
  };

  const handleReset = () => {
    setLocalDevice(deviceSettings);
    setLocalPlayback(playbackSettings);
    setHasChanges(false);
  };

  const defaults = {
    brightness: 1.0,
    contrast: 1.0,
    sharpness: 1.0,
    saturation: 1.0,
    inky_saturation: 0.5,
  };

  const isDefault = (key: string) => {
    return localDevice.image_settings[key as keyof typeof localDevice.image_settings] ===
      defaults[key as keyof typeof defaults];
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto px-4 pt-3 pb-24">
        {/* Playback Settings */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Playback</h3>
          </div>

          <div className="space-y-4 bg-card rounded-xl p-4">
            {/* Default timeout */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  Default timeout
                </Label>
                <span className="text-sm text-mono font-medium">
                  {Math.floor(localPlayback.default_timeout_seconds / 60)}m
                </span>
              </div>
              <Slider
                value={[localPlayback.default_timeout_seconds]}
                min={10}
                max={3600}
                step={10}
                onValueChange={([v]: number[]) => updatePlayback({ default_timeout_seconds: v })}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>10s</span>
                <span>60m</span>
              </div>
            </div>

            <Separator />

            {/* Loop */}
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2 cursor-pointer">
                <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
                Loop playback
              </Label>
              <Switch
                checked={localPlayback.loop_enabled}
                onCheckedChange={(v: boolean) => updatePlayback({ loop_enabled: v })}
                id="toggle-loop"
              />
            </div>

            {/* Shuffle */}
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2 cursor-pointer">
                <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                Shuffle
              </Label>
              <Switch
                checked={localPlayback.shuffle_enabled}
                onCheckedChange={(v: boolean) => updatePlayback({ shuffle_enabled: v })}
                id="toggle-shuffle"
              />
            </div>

            {/* Auto-advance */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm flex items-center gap-2 cursor-pointer">
                  <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                  Auto-advance
                </Label>
                <p className="text-xs text-muted-foreground ml-5.5 mt-0.5">
                  Automatically show next image when timeout expires
                </p>
              </div>
              <Switch
                checked={localPlayback.auto_advance_enabled}
                onCheckedChange={(v: boolean) => updatePlayback({ auto_advance_enabled: v })}
                id="toggle-auto-advance"
              />
            </div>
          </div>
        </section>

        {/* Display Settings */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Display</h3>
          </div>

          <div className="space-y-4 bg-card rounded-xl p-4">
            {/* Resolution info */}
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                Resolution
              </Label>
              <Badge variant="secondary" className="text-xs text-mono">
                {localDevice.resolution[0]} × {localDevice.resolution[1]}
              </Badge>
            </div>

            {/* Orientation */}
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <RotateCw className="w-3.5 h-3.5 text-muted-foreground" />
                Orientation
              </Label>
              <Select
                value={localDevice.orientation}
                onValueChange={(v: string) => updateDevice({ orientation: v as 'horizontal' | 'vertical' })}
              >
                <SelectTrigger className="h-8 w-32 text-sm rounded-lg" id="select-orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="horizontal">Horizontal</SelectItem>
                  <SelectItem value="vertical">Vertical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Invert */}
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2 cursor-pointer">
                <FlipVertical className="w-3.5 h-3.5 text-muted-foreground" />
                Invert image
              </Label>
              <Switch
                checked={localDevice.inverted_image}
                onCheckedChange={(v: boolean) => updateDevice({ inverted_image: v })}
                id="toggle-invert"
              />
            </div>

            <Separator />

            {/* Timezone */}
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                Timezone
              </Label>
              <Select
                value={localDevice.timezone}
                onValueChange={(v: string) => updateDevice({ timezone: v })}
              >
                <SelectTrigger className="h-8 w-48 text-sm rounded-lg" id="select-timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="America/Chicago">America/Chicago</SelectItem>
                  <SelectItem value="America/Denver">America/Denver</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Europe/Berlin">Europe/Berlin</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Time format */}
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Time format
              </Label>
              <Select
                value={localDevice.time_format}
                onValueChange={(v: string) => updateDevice({ time_format: v as '12h' | '24h' })}
              >
                <SelectTrigger className="h-8 w-24 text-sm rounded-lg" id="select-time-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Log stats */}
            <div className="flex items-center justify-between">
              <Label className="text-sm flex items-center gap-2 cursor-pointer">
                <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                Log system stats
              </Label>
              <Switch
                checked={localDevice.log_system_stats}
                onCheckedChange={(v: boolean) => updateDevice({ log_system_stats: v })}
                id="toggle-log-stats"
              />
            </div>
          </div>
        </section>

        {/* Image Enhancement */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Image Enhancement</h3>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Info className="w-3 h-3" />
              Global — applies to all images
            </div>
          </div>

          <div className="space-y-5 bg-card rounded-xl p-4">
            {/* Brightness */}
            <EnhancementSlider
              icon={<Sun className="w-3.5 h-3.5" />}
              label="Brightness"
              value={localDevice.image_settings.brightness}
              defaultValue={defaults.brightness}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => updateImageSetting('brightness', v)}
              isDefault={isDefault('brightness')}
            />

            {/* Contrast */}
            <EnhancementSlider
              icon={<Contrast className="w-3.5 h-3.5" />}
              label="Contrast"
              value={localDevice.image_settings.contrast}
              defaultValue={defaults.contrast}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => updateImageSetting('contrast', v)}
              isDefault={isDefault('contrast')}
            />

            {/* Sharpness */}
            <EnhancementSlider
              icon={<Sparkles className="w-3.5 h-3.5" />}
              label="Sharpness"
              value={localDevice.image_settings.sharpness}
              defaultValue={defaults.sharpness}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => updateImageSetting('sharpness', v)}
              isDefault={isDefault('sharpness')}
            />

            {/* Saturation */}
            <EnhancementSlider
              icon={<Palette className="w-3.5 h-3.5" />}
              label="Saturation"
              value={localDevice.image_settings.saturation}
              defaultValue={defaults.saturation}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => updateImageSetting('saturation', v)}
              isDefault={isDefault('saturation')}
            />

            <Separator />

            {/* Inky Saturation */}
            <EnhancementSlider
              icon={<Droplets className="w-3.5 h-3.5" />}
              label="Inky Saturation"
              value={localDevice.image_settings.inky_saturation}
              defaultValue={defaults.inky_saturation}
              min={0}
              max={1}
              step={0.05}
              onChange={(v) => updateImageSetting('inky_saturation', v)}
              isDefault={isDefault('inky_saturation')}
              hint="E-ink display color intensity"
            />
          </div>
        </section>
      </div>

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="fixed bottom-16 left-0 right-0 px-4 py-3 bg-background/90 backdrop-blur-lg border-t border-border animate-slide-up">
          <div className="flex gap-2 max-w-lg mx-auto">
            <Button
              variant="outline"
              className="flex-1 h-10 rounded-xl gap-1.5"
              onClick={handleReset}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button
              className="flex-1 h-10 rounded-xl gap-1.5"
              onClick={handleSave}
              id="btn-save-settings"
            >
              <Save className="w-4 h-4" />
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Enhancement slider component
function EnhancementSlider({
  icon,
  label,
  value,
  defaultValue,
  min,
  max,
  step,
  onChange,
  isDefault,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  defaultValue: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  isDefault: boolean;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          {label}
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-mono font-medium w-10 text-right">
            {value.toFixed(2)}
          </span>
          {!isDefault && (
            <button
              onClick={() => onChange(defaultValue)}
              className="text-[10px] text-primary hover:text-primary/80 underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>
      {hint && (
        <p className="text-[11px] text-muted-foreground ml-5.5">{hint}</p>
      )}
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]: number[]) => onChange(v)}
      />
    </div>
  );
}
