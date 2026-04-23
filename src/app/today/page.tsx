import MyWorkplaceComponent from "@/features/workspace/components/MyWorkplaceComponents/MyWorkplaceComponent";

export default function TodayPage() {
  return <MyWorkplaceComponent regionOrder={1} dueDateFilter="today" />;
}
