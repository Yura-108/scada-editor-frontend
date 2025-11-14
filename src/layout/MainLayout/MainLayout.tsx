import * as React from "react";

interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({children}) => {
  return (
    <div className={"main-container"}>
      {children}
    </div>
  )
}

export default MainLayout;