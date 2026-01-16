
import React, { useRef, useState, useEffect } from 'react';
import { Download, X, Instagram, Twitter, MessageCircle, Copy, Check, Sparkles, MapPin, Calendar, Users, Wallet, Plane, Clock, Star, Heart, Compass } from 'lucide-react';
import { Language } from '../types';
import { TRANSLATIONS } from '../utils/i18n';

// Clean markdown formatting from text
function cleanMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold **text**
    .replace(/\*([^*]+)\*/g, '$1')     // Italic *text*
    .replace(/__([^_]+)__/g, '$1')     // Bold __text__
    .replace(/_([^_]+)_/g, '$1')       // Italic _text_
    .replace(/~~([^~]+)~~/g, '$1')     // Strikethrough
    .replace(/`([^`]+)`/g, '$1')       // Inline code
    .replace(/#{1,6}\s*/g, '')         // Headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/^\s*[-*+]\s*/gm, '')     // List markers
    .replace(/^\s*\d+\.\s*/gm, '')     // Numbered list markers
    .trim();
}

interface ShareCardProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  tripData: {
    destination: string;
    dates: string;
    travelers: string;
    budget: string;
    pace: string;
    interests: string;
    highlights?: string[];
  };
  shareUrl: string;
}

// Card translations
const CARD_TRANSLATIONS: Record<Language, {
  title: string;
  subtitle: string;
  highlights: string;
  scanToView: string;
  poweredBy: string;
  download: string;
  downloadStory: string;
  downloadSquare: string;
  copyLink: string;
  shareTwitter: string;
  shareInstagram: string;
  shareLine: string;
  shareWeChat: string;
  modalTitle: string;
  modalSubtitle: string;
}> = {
  'en': {
    title: 'My Trip Plan',
    subtitle: 'AI-Powered Itinerary',
    highlights: 'Trip Highlights',
    scanToView: 'Scan to view full itinerary',
    poweredBy: 'Planned by Trip OS AI',
    download: 'Download Image',
    downloadStory: 'Story (9:16)',
    downloadSquare: 'Square (1:1)',
    copyLink: 'Copy Link',
    shareTwitter: 'Share on X',
    shareInstagram: 'Instagram Story',
    shareLine: 'Share on LINE',
    shareWeChat: 'Share on WeChat',
    modalTitle: 'Share Your Trip',
    modalSubtitle: 'Create a beautiful share card',
  },
  'zh-TW': {
    title: '我的旅行計畫',
    subtitle: 'AI 智能規劃行程',
    highlights: '行程亮點',
    scanToView: '掃碼查看完整行程',
    poweredBy: '由 Trip OS AI 規劃',
    download: '下載圖片',
    downloadStory: '限動尺寸 (9:16)',
    downloadSquare: '方形 (1:1)',
    copyLink: '複製連結',
    shareTwitter: '分享到 X',
    shareInstagram: 'Instagram 限動',
    shareLine: '分享到 LINE',
    shareWeChat: '分享到微信',
    modalTitle: '分享你的行程',
    modalSubtitle: '生成精美分享卡片',
  },
  'zh-CN': {
    title: '我的旅行计划',
    subtitle: 'AI 智能规划行程',
    highlights: '行程亮点',
    scanToView: '扫码查看完整行程',
    poweredBy: '由 Trip OS AI 规划',
    download: '下载图片',
    downloadStory: '故事尺寸 (9:16)',
    downloadSquare: '方形 (1:1)',
    copyLink: '复制链接',
    shareTwitter: '分享到 X',
    shareInstagram: 'Instagram 故事',
    shareLine: '分享到 LINE',
    shareWeChat: '分享到微信',
    modalTitle: '分享你的行程',
    modalSubtitle: '生成精美分享卡片',
  },
  'ja': {
    title: '旅行プラン',
    subtitle: 'AI旅程プランナー',
    highlights: 'ハイライト',
    scanToView: 'QRコードで全行程を見る',
    poweredBy: 'Trip OS AI で作成',
    download: '画像をダウンロード',
    downloadStory: 'ストーリー (9:16)',
    downloadSquare: 'スクエア (1:1)',
    copyLink: 'リンクをコピー',
    shareTwitter: 'Xでシェア',
    shareInstagram: 'Instagramストーリー',
    shareLine: 'LINEでシェア',
    shareWeChat: 'WeChatでシェア',
    modalTitle: '旅行をシェア',
    modalSubtitle: '美しいシェアカードを作成',
  },
  'ko': {
    title: '나의 여행 계획',
    subtitle: 'AI 여행 플래너',
    highlights: '하이라이트',
    scanToView: 'QR 코드로 전체 일정 보기',
    poweredBy: 'Trip OS AI로 계획',
    download: '이미지 다운로드',
    downloadStory: '스토리 (9:16)',
    downloadSquare: '정사각형 (1:1)',
    copyLink: '링크 복사',
    shareTwitter: 'X에서 공유',
    shareInstagram: '인스타그램 스토리',
    shareLine: 'LINE에서 공유',
    shareWeChat: 'WeChat에서 공유',
    modalTitle: '여행 공유하기',
    modalSubtitle: '아름다운 공유 카드 만들기',
  },
  'es': {
    title: 'Mi Plan de Viaje',
    subtitle: 'Itinerario con IA',
    highlights: 'Destacados',
    scanToView: 'Escanea para ver el itinerario',
    poweredBy: 'Planificado por Trip OS AI',
    download: 'Descargar Imagen',
    downloadStory: 'Historia (9:16)',
    downloadSquare: 'Cuadrado (1:1)',
    copyLink: 'Copiar Enlace',
    shareTwitter: 'Compartir en X',
    shareInstagram: 'Historia de Instagram',
    shareLine: 'Compartir en LINE',
    shareWeChat: 'Compartir en WeChat',
    modalTitle: 'Comparte tu Viaje',
    modalSubtitle: 'Crea una tarjeta para compartir',
  },
  'fr': {
    title: 'Mon Plan de Voyage',
    subtitle: 'Itinéraire IA',
    highlights: 'Points Forts',
    scanToView: 'Scannez pour voir l\'itinéraire',
    poweredBy: 'Planifié par Trip OS AI',
    download: 'Télécharger l\'Image',
    downloadStory: 'Story (9:16)',
    downloadSquare: 'Carré (1:1)',
    copyLink: 'Copier le Lien',
    shareTwitter: 'Partager sur X',
    shareInstagram: 'Story Instagram',
    shareLine: 'Partager sur LINE',
    shareWeChat: 'Partager sur WeChat',
    modalTitle: 'Partagez votre Voyage',
    modalSubtitle: 'Créez une belle carte à partager',
  },
  'hi': {
    title: 'मेरी यात्रा योजना',
    subtitle: 'AI यात्रा प्लानर',
    highlights: 'हाइलाइट्स',
    scanToView: 'पूरा कार्यक्रम देखने के लिए स्कैन करें',
    poweredBy: 'Trip OS AI द्वारा योजनाबद्ध',
    download: 'छवि डाउनलोड करें',
    downloadStory: 'स्टोरी (9:16)',
    downloadSquare: 'वर्गाकार (1:1)',
    copyLink: 'लिंक कॉपी करें',
    shareTwitter: 'X पर साझा करें',
    shareInstagram: 'Instagram स्टोरी',
    shareLine: 'LINE पर साझा करें',
    shareWeChat: 'WeChat पर साझा करें',
    modalTitle: 'अपनी यात्रा साझा करें',
    modalSubtitle: 'एक सुंदर शेयर कार्ड बनाएं',
  },
  'ar': {
    title: 'خطة رحلتي',
    subtitle: 'مسار الذكاء الاصطناعي',
    highlights: 'أبرز المعالم',
    scanToView: 'امسح لعرض المسار الكامل',
    poweredBy: 'مخطط بواسطة Trip OS AI',
    download: 'تحميل الصورة',
    downloadStory: 'ستوري (9:16)',
    downloadSquare: 'مربع (1:1)',
    copyLink: 'نسخ الرابط',
    shareTwitter: 'مشاركة على X',
    shareInstagram: 'ستوري انستغرام',
    shareLine: 'مشاركة على LINE',
    shareWeChat: 'مشاركة على WeChat',
    modalTitle: 'شارك رحلتك',
    modalSubtitle: 'إنشاء بطاقة مشاركة جميلة',
  },
  'pt': {
    title: 'Meu Plano de Viagem',
    subtitle: 'Roteiro com IA',
    highlights: 'Destaques',
    scanToView: 'Escaneie para ver o roteiro',
    poweredBy: 'Planejado por Trip OS AI',
    download: 'Baixar Imagem',
    downloadStory: 'Story (9:16)',
    downloadSquare: 'Quadrado (1:1)',
    copyLink: 'Copiar Link',
    shareTwitter: 'Compartilhar no X',
    shareInstagram: 'Story do Instagram',
    shareLine: 'Compartilhar no LINE',
    shareWeChat: 'Compartilhar no WeChat',
    modalTitle: 'Compartilhe sua Viagem',
    modalSubtitle: 'Crie um cartão de compartilhamento',
  },
  'ru': {
    title: 'Мой План Путешествия',
    subtitle: 'AI-маршрут',
    highlights: 'Основное',
    scanToView: 'Сканируйте для просмотра маршрута',
    poweredBy: 'Создано Trip OS AI',
    download: 'Скачать Изображение',
    downloadStory: 'Сторис (9:16)',
    downloadSquare: 'Квадрат (1:1)',
    copyLink: 'Копировать Ссылку',
    shareTwitter: 'Поделиться в X',
    shareInstagram: 'История в Instagram',
    shareLine: 'Поделиться в LINE',
    shareWeChat: 'Поделиться в WeChat',
    modalTitle: 'Поделитесь путешествием',
    modalSubtitle: 'Создайте красивую карточку',
  },
};

// Pace icons and colors
const PACE_CONFIG: Record<string, { emoji: string; color: string }> = {
  'Slow': { emoji: '🐢', color: '#10b981' },
  'Moderate': { emoji: '🚶', color: '#3b82f6' },
  'Fast': { emoji: '🏃', color: '#f59e0b' },
  'Intense': { emoji: '⚡', color: '#ef4444' },
};

// Extract trip duration from dates string
function extractDuration(dates: string): string {
  const match = dates.match(/(\d+)\s*(天|日|days?|días?|jours?|дн|أيام|दिन|일)/i);
  if (match) return match[0];

  // Try to extract from date range
  const dateMatch = dates.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g);
  if (dateMatch && dateMatch.length >= 2) {
    const start = new Date(dateMatch[0]);
    const end = new Date(dateMatch[1]);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return `${days}`;
  }
  return '';
}

// Generate QR Code SVG (simple implementation)
function generateQRCodeSVG(url: string, size: number = 100): string {
  // Using a simple QR code pattern - in production, use a proper QR library
  // For now, we'll create a placeholder that works with QR code API
  const encodedUrl = encodeURIComponent(url);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedUrl}&bgcolor=ffffff&color=1e293b&margin=0`;
}

const ShareCard: React.FC<ShareCardProps> = ({
  isOpen,
  onClose,
  language,
  tripData,
  shareUrl
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [qrLoaded, setQrLoaded] = useState(false);
  const cardT = CARD_TRANSLATIONS[language] || CARD_TRANSLATIONS['en'];
  const t = TRANSLATIONS[language] || TRANSLATIONS['en'];

  // Preload QR code image
  useEffect(() => {
    if (isOpen && shareUrl) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setQrLoaded(true);
      img.src = generateQRCodeSVG(shareUrl, 150);
    }
  }, [isOpen, shareUrl]);

  const duration = extractDuration(tripData.dates);
  const paceConfig = PACE_CONFIG[tripData.pace] || PACE_CONFIG['Moderate'];

  // Extract highlights from interests and clean markdown
  const rawHighlights = tripData.highlights || tripData.interests.split(/[,，、]/).slice(0, 4).map(s => s.trim()).filter(Boolean);
  const highlights = rawHighlights.map(h => cleanMarkdown(h)).filter(h => h.length > 0 && h.length < 50);

  const generateImage = async (aspectRatio: '9:16' | '1:1') => {
    setIsGenerating(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size based on aspect ratio
    const width = aspectRatio === '1:1' ? 1080 : 1080;
    const height = aspectRatio === '1:1' ? 1080 : 1920;
    canvas.width = width;
    canvas.height = height;

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#0f172a');
    gradient.addColorStop(0.5, '#1e293b');
    gradient.addColorStop(1, '#0f172a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Decorative elements
    ctx.save();
    ctx.globalAlpha = 0.1;

    // Grid pattern
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, height);
      ctx.stroke();
    }
    for (let i = 0; i < height; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(width, i);
      ctx.stroke();
    }

    // Decorative circles
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(width * 0.8, height * 0.2, 300, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(width * 0.2, height * 0.8, 250, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Card content area
    const padding = 60;
    const cardMargin = 40;
    const cardWidth = width - cardMargin * 2;
    const cardHeight = height - cardMargin * 2;

    // Card background with rounded corners
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 10;
    roundRect(ctx, cardMargin, cardMargin, cardWidth, cardHeight, 40);
    ctx.fill();
    ctx.restore();

    // Content positioning
    let y = cardMargin + padding;
    const contentX = cardMargin + padding;
    const contentWidth = cardWidth - padding * 2;

    // App branding
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 28px Inter, system-ui, sans-serif';
    ctx.fillText('TRIP OS', contentX, y);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px Inter, system-ui, sans-serif';
    ctx.fillText(' • ' + cardT.subtitle, contentX + ctx.measureText('TRIP OS').width, y);

    y += 80;

    // Title section with emoji
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 72px Inter, system-ui, sans-serif';

    // Destination flag/emoji based on common destinations
    const destEmoji = getDestinationEmoji(tripData.destination);
    const titleText = `${destEmoji} ${tripData.destination}`;

    // Word wrap for long destination names
    const titleLines = wrapText(ctx, titleText, contentWidth, 72);
    titleLines.forEach(line => {
      ctx.fillText(line, contentX, y);
      y += 85;
    });

    y += 20;

    // Duration badge
    if (duration) {
      ctx.save();
      ctx.fillStyle = '#3b82f6';
      roundRect(ctx, contentX, y, 200, 60, 30);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 32px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`📅 ${duration}`, contentX + 100, y + 42);
      ctx.textAlign = 'left';
      ctx.restore();
      y += 100;
    }

    // Info cards
    const infoItems = [
      { icon: '👥', label: tripData.travelers || '-' },
      { icon: '💰', label: tripData.budget || '-' },
      { icon: paceConfig.emoji, label: t.form.pace_options[tripData.pace as keyof typeof t.form.pace_options] || tripData.pace },
    ].filter(item => item.label && item.label !== '-');

    if (infoItems.length > 0) {
      const itemWidth = contentWidth / infoItems.length - 20;
      infoItems.forEach((item, index) => {
        const x = contentX + (itemWidth + 20) * index;

        // Info card background
        ctx.save();
        ctx.fillStyle = '#f1f5f9';
        roundRect(ctx, x, y, itemWidth, 100, 20);
        ctx.fill();
        ctx.restore();

        // Icon and text
        ctx.font = '40px Inter, system-ui, sans-serif';
        ctx.fillText(item.icon, x + 20, y + 55);

        ctx.fillStyle = '#334155';
        ctx.font = '28px Inter, system-ui, sans-serif';
        const labelText = truncateText(ctx, item.label, itemWidth - 80);
        ctx.fillText(labelText, x + 70, y + 60);
      });
      y += 140;
    }

    // Highlights section
    if (highlights.length > 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 28px Inter, system-ui, sans-serif';
      ctx.fillText(`✨ ${cardT.highlights}`, contentX, y);
      y += 50;

      // Highlight chips
      let chipX = contentX;
      let chipY = y;
      const chipHeight = 50;
      const chipPadding = 24;
      const chipGap = 16;

      highlights.forEach(highlight => {
        ctx.font = '26px Inter, system-ui, sans-serif';
        const textWidth = ctx.measureText(highlight).width;
        const chipWidth = textWidth + chipPadding * 2;

        // Check if chip fits in current row
        if (chipX + chipWidth > contentX + contentWidth) {
          chipX = contentX;
          chipY += chipHeight + chipGap;
        }

        // Chip background
        ctx.save();
        ctx.fillStyle = '#e0f2fe';
        roundRect(ctx, chipX, chipY, chipWidth, chipHeight, 25);
        ctx.fill();
        ctx.restore();

        // Chip text
        ctx.fillStyle = '#0369a1';
        ctx.fillText(highlight, chipX + chipPadding, chipY + 34);

        chipX += chipWidth + chipGap;
      });

      y = chipY + chipHeight + 60;
    }

    // QR Code section (at bottom for story, center-bottom for square)
    const qrSize = aspectRatio === '1:1' ? 160 : 200;
    const qrY = aspectRatio === '1:1'
      ? cardMargin + cardHeight - padding - qrSize - 80
      : cardMargin + cardHeight - padding - qrSize - 100;
    const qrX = (width - qrSize) / 2;

    // QR code background
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = 20;
    roundRect(ctx, qrX - 20, qrY - 20, qrSize + 40, qrSize + 40, 20);
    ctx.fill();
    ctx.restore();

    // Load and draw QR code
    try {
      const qrImg = new Image();
      qrImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        qrImg.onload = () => {
          ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
          resolve();
        };
        qrImg.onerror = reject;
        qrImg.src = generateQRCodeSVG(shareUrl, qrSize);
      });
    } catch (e) {
      // Fallback: draw placeholder
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '24px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('QR Code', qrX + qrSize / 2, qrY + qrSize / 2);
      ctx.textAlign = 'left';
    }

    // Scan text
    ctx.fillStyle = '#64748b';
    ctx.font = '24px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cardT.scanToView, width / 2, qrY + qrSize + 50);
    ctx.textAlign = 'left';

    // Footer branding
    const footerY = cardMargin + cardHeight - 40;
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cardT.poweredBy, width / 2, footerY);
    ctx.textAlign = 'left';

    // Download the image
    const link = document.createElement('a');
    link.download = `TripOS-${tripData.destination.replace(/[^a-zA-Z0-9]/g, '-')}-${aspectRatio.replace(':', 'x')}.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();

    setIsGenerating(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(`${tripData.destination} 旅行計畫 ✈️\n${cardT.poweredBy}`);
    const url = encodeURIComponent(shareUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank');
  };

  const handleShareLine = () => {
    const url = encodeURIComponent(shareUrl);
    window.open(`https://social-plugins.line.me/lineit/share?url=${url}`, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-900">{cardT.modalTitle}</h3>
              <p className="text-sm text-slate-500">{cardT.modalSubtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Preview Card - Attractive Infographic Style */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-1 shadow-xl shadow-purple-500/20">
            <div className="bg-white rounded-xl overflow-hidden">
              {/* Hero Section with Destination */}
              <div className="relative bg-gradient-to-br from-slate-900 via-indigo-900 to-purple-900 p-6 text-white overflow-hidden">
                {/* Animated background elements */}
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
                  <div className="absolute bottom-0 right-0 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-pink-500/10 rounded-full blur-2xl" />
                  {/* Floating plane icon */}
                  <Plane className="absolute top-4 right-4 w-8 h-8 text-white/10 transform rotate-45" />
                </div>

                <div className="relative z-10">
                  {/* Branding badge */}
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-xs font-medium mb-4 border border-white/10">
                    <Compass className="w-3 h-3" />
                    <span className="uppercase tracking-wider">Trip OS</span>
                    <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                  </div>

                  {/* Destination with large emoji */}
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-4xl">{getDestinationEmoji(tripData.destination)}</span>
                    <div>
                      <h4 className="text-2xl font-bold leading-tight">{cleanMarkdown(tripData.destination)}</h4>
                      <p className="text-white/60 text-sm">{cardT.subtitle}</p>
                    </div>
                  </div>

                  {/* Duration highlight */}
                  {duration && (
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full text-sm font-semibold shadow-lg shadow-blue-500/30">
                      <Calendar className="w-4 h-4" />
                      <span>{cleanMarkdown(duration)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Info Cards Section */}
              <div className="p-4 bg-gradient-to-b from-slate-50 to-white">
                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {tripData.travelers && (
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center group hover:shadow-md hover:border-blue-200 transition-all">
                      <div className="w-8 h-8 mx-auto mb-1.5 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                        <Users className="w-4 h-4 text-blue-600 group-hover:text-white transition-colors" />
                      </div>
                      <p className="text-xs text-slate-500 mb-0.5">Travelers</p>
                      <p className="font-semibold text-slate-900 text-sm truncate">{cleanMarkdown(tripData.travelers)}</p>
                    </div>
                  )}
                  {tripData.budget && (
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center group hover:shadow-md hover:border-green-200 transition-all">
                      <div className="w-8 h-8 mx-auto mb-1.5 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-500 transition-colors">
                        <Wallet className="w-4 h-4 text-green-600 group-hover:text-white transition-colors" />
                      </div>
                      <p className="text-xs text-slate-500 mb-0.5">Budget</p>
                      <p className="font-semibold text-slate-900 text-sm truncate">{cleanMarkdown(tripData.budget)}</p>
                    </div>
                  )}
                  {tripData.pace && (
                    <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-100 text-center group hover:shadow-md hover:border-amber-200 transition-all">
                      <div className="w-8 h-8 mx-auto mb-1.5 bg-amber-100 rounded-full flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                        <Clock className="w-4 h-4 text-amber-600 group-hover:text-white transition-colors" />
                      </div>
                      <p className="text-xs text-slate-500 mb-0.5">Pace</p>
                      <p className="font-semibold text-slate-900 text-sm">{paceConfig.emoji}</p>
                    </div>
                  )}
                </div>

                {/* Highlights Section */}
                {highlights.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Star className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-semibold text-slate-700">{cardT.highlights}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {highlights.slice(0, 4).map((h, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-full text-xs font-medium text-indigo-700"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500" />
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer with branding */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs text-slate-500">{cardT.poweredBy}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Heart className="w-3 h-3 text-pink-400" />
                    <span>tripos.ai</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 space-y-4 bg-gradient-to-b from-white to-slate-50">
          {/* Download buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => generateImage('9:16')}
              disabled={isGenerating}
              className="group flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-xl font-semibold shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              <Instagram className="w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span className="text-sm">{cardT.downloadStory}</span>
            </button>
            <button
              onClick={() => generateImage('1:1')}
              disabled={isGenerating}
              className="group flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
            >
              <Download className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" />
              <span className="text-sm">{cardT.downloadSquare}</span>
            </button>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
                copySuccess
                  ? 'bg-green-100 text-green-700 ring-2 ring-green-200'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 hover:border-slate-300 shadow-sm'
              }`}
            >
              {copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copySuccess ? t.actions.copied : cardT.copyLink}
            </button>
            <button
              onClick={handleShareTwitter}
              className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all"
              title={cardT.shareTwitter}
            >
              <Twitter className="w-5 h-5" />
            </button>
            <button
              onClick={handleShareLine}
              className="p-3 bg-[#00B900] text-white rounded-xl hover:brightness-110 shadow-lg shadow-green-500/20 hover:shadow-green-500/40 hover:scale-105 active:scale-95 transition-all"
              title={cardT.shareLine}
            >
              <MessageCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Tip text */}
          <p className="text-center text-xs text-slate-400 pt-2">
            {language.startsWith('zh') ? '下載圖片後可直接分享到社群媒體' : 'Download the image to share on social media'}
          </p>
        </div>

        {/* Hidden canvas for image generation */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

// Helper functions
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number): string[] {
  const words = text.split('');
  const lines: string[] = [];
  let currentLine = '';

  for (const char of words) {
    const testLine = currentLine + char;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines.slice(0, 2); // Max 2 lines
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let truncated = text;
  while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + '...';
}

function getDestinationEmoji(destination: string): string {
  const dest = destination.toLowerCase();

  // Country/region mappings
  const emojiMap: Record<string, string> = {
    'japan': '🗾', '日本': '🗾', 'tokyo': '🗼', '東京': '🗼', '东京': '🗼',
    'kyoto': '⛩️', '京都': '⛩️', 'osaka': '🏯', '大阪': '🏯',
    'korea': '🇰🇷', '韓國': '🇰🇷', '韩国': '🇰🇷', 'seoul': '🇰🇷', '首爾': '🇰🇷',
    'taiwan': '🇹🇼', '台灣': '🇹🇼', '台湾': '🇹🇼', 'taipei': '🇹🇼', '台北': '🇹🇼',
    'thailand': '🇹🇭', '泰國': '🇹🇭', '泰国': '🇹🇭', 'bangkok': '🇹🇭', '曼谷': '🇹🇭',
    'vietnam': '🇻🇳', '越南': '🇻🇳',
    'singapore': '🇸🇬', '新加坡': '🇸🇬',
    'hong kong': '🇭🇰', '香港': '🇭🇰',
    'china': '🇨🇳', '中國': '🇨🇳', '中国': '🇨🇳', 'beijing': '🇨🇳', '北京': '🇨🇳', 'shanghai': '🇨🇳', '上海': '🇨🇳',
    'usa': '🇺🇸', 'america': '🇺🇸', '美國': '🇺🇸', '美国': '🇺🇸', 'new york': '🗽', '紐約': '🗽',
    'france': '🇫🇷', '法國': '🇫🇷', '法国': '🇫🇷', 'paris': '🗼', '巴黎': '🗼',
    'italy': '🇮🇹', '義大利': '🇮🇹', '意大利': '🇮🇹', 'rome': '🏛️', '羅馬': '🏛️',
    'spain': '🇪🇸', '西班牙': '🇪🇸', 'barcelona': '🇪🇸',
    'uk': '🇬🇧', 'england': '🇬🇧', '英國': '🇬🇧', '英国': '🇬🇧', 'london': '🇬🇧', '倫敦': '🇬🇧',
    'germany': '🇩🇪', '德國': '🇩🇪', '德国': '🇩🇪',
    'australia': '🇦🇺', '澳洲': '🇦🇺', 'sydney': '🇦🇺',
    'bali': '🏝️', '峇里島': '🏝️', '巴厘岛': '🏝️',
    'maldives': '🏝️', '馬爾代夫': '🏝️', '马尔代夫': '🏝️',
    'hawaii': '🌺', '夏威夷': '🌺',
    'dubai': '🏙️', '杜拜': '🏙️', '迪拜': '🏙️',
  };

  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (dest.includes(key)) return emoji;
  }

  return '✈️'; // Default
}

export default ShareCard;
