"use client"

import StartMenu from "@/components/StartMenu";
import {useState} from "react";
import {DeviceNodeType, DeviceParamsType} from "@/types/nodeTypes";
import LogoutButton from "@/components/LogoutButton";
import DeviceTreePanel from "@/components/DeviceTreePanel";

export default function Workspace() {
  const [projectData, setProjectData] = useState(null);

  return (
    <div>
      <div className="mt-auto pt-8 border-t border-gray-200">
        <LogoutButton />
      </div>
      {!projectData ? (<StartMenu onProjectLoaded={setProjectData} />) : (
        <DeviceTreePanel />
      )}
    </div>
  )
}