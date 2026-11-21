"use client";

import { FontAwesomeIcon, type FontAwesomeIconProps } from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import * as r from "@fortawesome/free-regular-svg-icons";
import * as s from "@fortawesome/free-solid-svg-icons";
import { faChrome } from "@fortawesome/free-brands-svg-icons";

/**
 * The app's icon set: Font Awesome icons under the names the components already
 * use, so every file imports its icons from here. `className` sizes (h-4 w-4 …)
 * and colours work as usual.
 */
type IconProps = Omit<FontAwesomeIconProps, "icon">;
const fa = (icon: IconDefinition) => {
  const Icon = (props: IconProps) => <FontAwesomeIcon icon={icon} {...props} />;
  Icon.displayName = `Fa(${icon.iconName})`;
  return Icon;
};
/** Type of an icon component from this file (for props and config maps). */
export type LucideIcon = ReturnType<typeof fa>;

// Arrows and chevrons
export const ArrowDown = fa(s.faArrowDown);
export const ArrowUp = fa(s.faArrowUp);
export const ArrowLeft = fa(s.faArrowLeft);
export const ArrowRight = fa(s.faArrowRight);
export const ArrowDownRight = fa(s.faArrowTrendDown);
export const ArrowUpRight = fa(s.faArrowTrendUp);
export const ArrowRightLeft = fa(s.faRightLeft);
export const ArrowLeftRight = fa(s.faArrowRightArrowLeft);
export const ArrowUpDown = fa(s.faSort);
export const ChevronDown = fa(s.faChevronDown);
export const ChevronUp = fa(s.faChevronUp);
export const ChevronLeft = fa(s.faChevronLeft);
export const ChevronRight = fa(s.faChevronRight);
export const TrendingUp = fa(s.faArrowTrendUp);
export const TrendingDown = fa(s.faArrowTrendDown);
export const ExternalLink = fa(s.faArrowUpRightFromSquare);
export const RefreshCw = fa(s.faArrowsRotate);
export const RotateCcw = fa(s.faRotateLeft);
export const History = fa(s.faClockRotateLeft);

// Status and feedback
export const AlertCircle = fa(s.faCircleExclamation);
export const AlertTriangle = fa(s.faTriangleExclamation);
export const Info = fa(s.faCircleInfo);
export const Ban = fa(s.faBan);
export const Check = fa(s.faCheck);
export const CheckCheck = fa(s.faCheckDouble);
export const CheckCircle = fa(r.faCircleCheck);
export const CheckCircle2 = fa(r.faCircleCheck);
export const CircleCheck = fa(r.faCircleCheck);
export const CheckSquare = fa(r.faSquareCheck);
export const Circle = fa(s.faCircle);
export const X = fa(s.faXmark);
export const XCircle = fa(r.faCircleXmark);
export const Loader2 = fa(s.faSpinner);
export const Minus = fa(s.faMinus);
export const Plus = fa(s.faPlus);
export const MoreHorizontal = fa(s.faEllipsis);
export const Zap = fa(s.faBolt);
export const Sparkles = fa(s.faWandMagicSparkles);
export const Wand2 = fa(s.faWandMagicSparkles);
export const Wifi = fa(s.faWifi);
export const WifiOff = fa(s.faPlugCircleXmark);
export const Radio = fa(s.faTowerBroadcast);

// People
export const User = fa(r.faUser);
export const UserRound = fa(r.faUser);
export const Users = fa(s.faUserGroup);
export const UserCheck = fa(s.faUserCheck);
export const UserMinus = fa(s.faUserMinus);
export const UserPlus = fa(s.faUserPlus);
export const UserX = fa(s.faUserXmark);
export const UserRoundSearch = fa(s.faAddressCard);
export const Handshake = fa(s.faHandshake);
export const GraduationCap = fa(s.faGraduationCap);
export const Fingerprint = fa(s.faFingerprint);

// Time and calendar
export const Calendar = fa(r.faCalendar);
export const CalendarDays = fa(r.faCalendarDays);
export const CalendarCheck = fa(r.faCalendarCheck);
export const CalendarOff = fa(r.faCalendarXmark);
export const CalendarPlus = fa(r.faCalendarPlus);
export const Clock = fa(r.faClock);
export const Cake = fa(s.faCakeCandles);
export const Coffee = fa(s.faMugHot);
export const Plane = fa(s.faPlane);
export const Umbrella = fa(s.faUmbrellaBeach);
export const PartyPopper = fa(s.faChampagneGlasses);

// Files and content
export const File = fa(r.faFile);
export const FileText = fa(r.faFileLines);
export const FileImage = fa(r.faFileImage);
export const FileVideo = fa(r.faFileVideo);
export const FileSpreadsheet = fa(r.faFileExcel);
export const FilePlus = fa(s.faFileCirclePlus);
export const Image = fa(r.faImage);
export const Paperclip = fa(s.faPaperclip);
export const Copy = fa(r.faCopy);
export const Save = fa(r.faFloppyDisk);
export const Download = fa(s.faDownload);
export const Upload = fa(s.faUpload);
export const Printer = fa(s.faPrint);
export const ClipboardList = fa(s.faClipboardList);
export const ClipboardCheck = fa(s.faClipboardCheck);
export const ClipboardEdit = fa(r.faPenToSquare);
export const ScrollText = fa(s.faScroll);
export const Quote = fa(s.faQuoteLeft);
export const Hash = fa(s.faHashtag);
export const Link2 = fa(s.faLink);

// Editing and text
export const Pen = fa(s.faPen);
export const Pencil = fa(s.faPencil);
export const Edit2 = fa(s.faPen);
export const Trash2 = fa(r.faTrashCan);
export const Type = fa(s.faFont);
export const Heading1 = fa(s.faHeading);
export const Heading2 = fa(s.faHeading);
export const Heading3 = fa(s.faHeading);
export const AlignLeft = fa(s.faAlignLeft);
export const AlignCenter = fa(s.faAlignCenter);
export const AlignRight = fa(s.faAlignRight);
export const List = fa(s.faList);
export const ListOrdered = fa(s.faListOl);
export const ListChecks = fa(s.faListCheck);
export const ListPlus = fa(s.faListUl);
export const Palette = fa(s.faPalette);
export const Code2 = fa(s.faCode);
export const Bug = fa(s.faBug);

// Layout and navigation
export const Home = fa(s.faHouse);
export const LayoutGrid = fa(s.faTableCellsLarge);
export const LayoutList = fa(s.faTableList);
export const LayoutTemplate = fa(s.faTableColumns);
export const LayoutDashboard = fa(s.faGaugeHigh);
export const Columns = fa(s.faTableColumns);
export const Table = fa(s.faTable);
export const Table2 = fa(s.faTable);
export const Layers = fa(s.faLayerGroup);
export const Menu = fa(s.faBars);
export const GripVertical = fa(s.faGripVertical);
export const Search = fa(s.faMagnifyingGlass);
export const Filter = fa(s.faFilter);
export const SlidersHorizontal = fa(s.faSliders);
export const Settings = fa(s.faGear);
export const Settings2 = fa(s.faSliders);
export const PanelRightClose = fa(s.faAnglesRight);
export const PanelRightOpen = fa(s.faInbox);
export const Inbox = fa(s.faInbox);
export const Pin = fa(s.faThumbtack);
export const PinOff = fa(s.faThumbtack);
export const FolderKanban = fa(s.faFolderOpen);
export const HardDrive = fa(s.faHardDrive);
export const Tag = fa(s.faTag);
export const Eye = fa(r.faEye);
export const EyeOff = fa(r.faEyeSlash);
export const Moon = fa(r.faMoon);
export const Sun = fa(r.faSun);
export const Monitor = fa(s.faDesktop);
export const Laptop = fa(s.faLaptop);
export const MousePointerClick = fa(s.faArrowPointer);

// Communication
export const Bell = fa(r.faBell);
export const Mail = fa(r.faEnvelope);
export const MessageSquare = fa(r.faMessage);
export const Send = fa(r.faPaperPlane);
export const Phone = fa(s.faPhone);
export const PhoneCall = fa(s.faPhone);
export const Megaphone = fa(s.faBullhorn);
export const Video = fa(s.faVideo);
export const Camera = fa(s.faCamera);
export const Play = fa(s.faPlay);
export const PlayCircle = fa(r.faCirclePlay);
export const Pause = fa(s.faPause);

// Business
export const Briefcase = fa(s.faBriefcase);
export const Building2 = fa(s.faBuilding);
export const Banknote = fa(s.faMoneyBillWave);
export const DollarSign = fa(s.faDollarSign);
export const IndianRupee = fa(s.faIndianRupeeSign);
export const CreditCard = fa(r.faCreditCard);
export const Receipt = fa(s.faReceipt);
export const HandCoins = fa(s.faHandHoldingDollar);
export const Calculator = fa(s.faCalculator);
export const Scale = fa(s.faScaleBalanced);
export const BarChart2 = fa(s.faChartSimple);
export const BarChart3 = fa(s.faChartColumn);
export const PieChart = fa(s.faChartPie);
export const Target = fa(s.faBullseye);
export const Crosshair = fa(s.faCrosshairs);
export const Trophy = fa(s.faTrophy);
export const Award = fa(s.faAward);
export const Star = fa(r.faStar);
export const Rocket = fa(s.faRocket);
export const Lightbulb = fa(r.faLightbulb);
export const Package = fa(s.faBoxOpen);
export const Puzzle = fa(s.faPuzzlePiece);
export const Network = fa(s.faSitemap);
export const GitBranch = fa(s.faCodeBranch);
export const Server = fa(s.faServer);
export const Globe = fa(s.faGlobe);
export const Map = fa(r.faMap);
export const MapPin = fa(s.faLocationDot);
export const Construction = fa(s.faPersonDigging);
export const Chrome = fa(faChrome);

// Security and account
export const Lock = fa(s.faLock);
export const Unlock = fa(s.faUnlock);
export const KeyRound = fa(s.faKey);
export const Shield = fa(s.faShield);
export const ShieldCheck = fa(s.faShieldHalved);
export const ShieldX = fa(s.faUserShield);
export const LogIn = fa(s.faRightToBracket);
export const LogOut = fa(s.faRightFromBracket);
export const LifeBuoy = fa(r.faLifeRing);

// Draw and Guess
export const Gamepad2 = fa(s.faGamepad);
export const PaintBrush = fa(s.faPaintbrush);
export const EraserIcon = fa(s.faEraser);
export const UndoIcon = fa(s.faRotateLeft);
export const TrashCanIcon = fa(s.faTrashCan);
export const VolumeOn = fa(s.faVolumeHigh);
export const VolumeOff = fa(s.faVolumeXmark);
export const CrownIcon = fa(s.faCrown);
export const PencilIcon = fa(s.faPencil);
export const BellOff = fa(s.faBellSlash);
export const HandWave = fa(s.faHandsClapping);
export const HandIcon = fa(s.faHand);
export const LockIcon = fa(s.faLock);
export const PauseCircle = fa(s.faCirclePause);
