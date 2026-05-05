// src/components/inventory/product/ProductMediaGallery.tsx
"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Image as ImageIcon, Upload, X, Move, GripVertical, Play, Link } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface ProductMediaGalleryProps {
  product: any;
  onChange: (product: any) => void;
}

interface GalleryImage {
  url: string;
  caption?: string;
  order: number;
}

function SortableImageItem({ url, index, onRemove, onUpdateCaption }: { 
  url: string; 
  index: number; 
  onRemove: () => void;
  onUpdateCaption: (caption: string) => void;
}) {
  const [showCaption, setShowCaption] = useState(false);
  const [caption, setCaption] = useState("");
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
      {...attributes}
    >
      <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-border bg-muted/20">
        <img
          src={url}
          alt={`Gallery ${index + 1}`}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "https://placehold.co/400x400/e2e8f0/64748b?text=No+Image";
          }}
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <button
            {...listeners}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
          >
            <GripVertical className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={() => setShowCaption(!showCaption)}
            className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition"
          >
            <Link className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={onRemove}
            className="p-2 bg-destructive/80 rounded-lg hover:bg-destructive transition"
          >
            <Trash2 className="w-4 h-4 text-white" />
          </button>
        </div>
        {showCaption && (
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/80">
            <Input
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                onUpdateCaption(e.target.value);
              }}
              placeholder="Image caption..."
              className="h-8 text-sm bg-transparent border-white/20 text-white placeholder:text-white/50"
              autoFocus
            />
          </div>
        )}
      </div>
      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
        {index + 1}
      </div>
    </div>
  );
}

export default function ProductMediaGallery({ product, onChange }: ProductMediaGalleryProps) {
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(() => {
    try {
      const parsed = product.gallery_images ? JSON.parse(product.gallery_images) : [];
      return Array.isArray(parsed) ? parsed.map((url: string | GalleryImage, idx: number) => 
        typeof url === "string" ? { url, order: idx } : url
      ) : [];
    } catch {
      return [];
    }
  });
  
  const [newImageUrl, setNewImageUrl] = useState("");
  const [mainImageUrl, setMainImageUrl] = useState(product.main_image || "");
  const [videoUrl, setVideoUrl] = useState(product.video_url || "");
  const [isDragging, setIsDragging] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateGallery = useCallback((newImages: GalleryImage[]) => {
    setGalleryImages(newImages);
    const galleryData = JSON.stringify(newImages.map(img => img.url));
    onChange({ ...product, gallery_images: galleryData });
  }, [product, onChange]);

  const addGalleryImage = () => {
    if (newImageUrl && !galleryImages.some(img => img.url === newImageUrl)) {
      const newImages = [...galleryImages, { url: newImageUrl, order: galleryImages.length }];
      updateGallery(newImages);
      setNewImageUrl("");
    }
  };

  const removeGalleryImage = (index: number) => {
    const newImages = galleryImages.filter((_, i) => i !== index);
    newImages.forEach((img, idx) => (img.order = idx));
    updateGallery(newImages);
  };

  const updateImageCaption = (index: number, caption: string) => {
    const newImages = [...galleryImages];
    newImages[index].caption = caption;
    updateGallery(newImages);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      const oldIndex = galleryImages.findIndex(img => img.url === active.id);
      const newIndex = galleryImages.findIndex(img => img.url === over?.id);
      const newImages = arrayMove(galleryImages, oldIndex, newIndex);
      newImages.forEach((img, idx) => (img.order = idx));
      updateGallery(newImages);
    }
    setIsDragging(false);
  };

  const handleMainImageChange = (url: string) => {
    setMainImageUrl(url);
    onChange({ ...product, main_image: url });
  };

  const handleVideoUrlChange = (url: string) => {
    setVideoUrl(url);
    onChange({ ...product, video_url: url });
  };

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  const getYoutubeEmbedUrl = (url: string) => {
    const videoId = extractYoutubeId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  return (
    <div className="space-y-6">
      {/* Main Image */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4">Main Product Image</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  value={mainImageUrl}
                  onChange={(e) => handleMainImageChange(e.target.value)}
                  placeholder="https://example.com/main-image.jpg"
                  className="flex-1"
                />
                <Button variant="outline" size="icon" onClick={() => handleMainImageChange("")}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Enter a valid image URL (JPG, PNG, WebP)</p>
            </div>
            <div className="flex justify-center">
              {mainImageUrl ? (
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border">
                  <img
                    src={mainImageUrl}
                    alt="Main product"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://placehold.co/400x400/e2e8f0/64748b?text=No+Image";
                    }}
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg border-2 border-dashed border-border flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gallery Images */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Gallery Images</h3>
            <div className="flex gap-2">
              <Input
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                placeholder="Enter image URL..."
                className="w-64 h-8 text-sm"
                onKeyPress={(e) => e.key === "Enter" && addGalleryImage()}
              />
              <Button size="sm" onClick={addGalleryImage} disabled={!newImageUrl}>
                <Plus className="w-4 h-4 mr-1" /> Add
              </Button>
            </div>
          </div>
          
          {galleryImages.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border rounded-lg">
              <Upload className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
              <p className="text-sm text-muted-foreground">No gallery images yet</p>
              <p className="text-xs text-muted-foreground">Add product photos, diagrams, or lifestyle images</p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
              onDragStart={() => setIsDragging(true)}
            >
              <SortableContext
                items={galleryImages.map(img => img.url)}
                strategy={verticalListSortingStrategy}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {galleryImages.map((img, idx) => (
                    <SortableImageItem
                      key={img.url}
                      url={img.url}
                      index={idx}
                      onRemove={() => removeGalleryImage(idx)}
                      onUpdateCaption={(caption) => updateImageCaption(idx, caption)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
          
          {galleryImages.length > 0 && (
            <p className="text-xs text-muted-foreground mt-3 text-center">
              💡 Drag and drop images to reorder. Click the link icon to add captions.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Video URL */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-medium mb-4 flex items-center gap-2">
            <Play className="w-4 h-4" /> Product Video
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm">Video URL</Label>
              <Input
                value={videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
              />
              <p className="text-xs text-muted-foreground">Supports YouTube, Vimeo, and direct video links</p>
            </div>
            <div>
              {getYoutubeEmbedUrl(videoUrl) && (
                <div className="aspect-video rounded-lg overflow-hidden border border-border">
                  <iframe
                    src={getYoutubeEmbedUrl(videoUrl)!}
                    title="Product video"
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Box */}
      <div className="bg-muted/20 rounded-lg p-3 text-sm">
        <p className="text-muted-foreground">
          🖼️ <strong>Image Guidelines:</strong> Use high-quality images (minimum 800x800px). 
          The first image will be shown as the primary product photo. Supported formats: JPG, PNG, WebP, SVG.
        </p>
      </div>
    </div>
  );
}