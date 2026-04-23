import MyWorkplaceComponent from "@/features/workspace/components/MyWorkplaceComponents/MyWorkplaceComponent";

export default function ThisWeekPage() {
  return <MyWorkplaceComponent regionOrder={1} dueDateFilter="this-week" />;
}
